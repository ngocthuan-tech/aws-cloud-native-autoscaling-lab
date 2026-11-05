import { mkdirSync, writeFileSync } from 'node:fs';
import { aws, DIGEST, SHA, isMain, loadTargets, readJson, requireService, summary } from './common.mjs';

export function serviceFrom(response) {
  if (response.failures?.length || response.services?.length !== 1) throw new Error('ECS service not found or inaccessible');
  return response.services[0];
}

export function preflight(service, task, target) {
  if (service.status !== 'ACTIVE' || service.desiredCount < 1) throw new Error('A must create and start the service before CD');
  if (service.deploymentController?.type !== 'ECS') throw new Error('Only ECS rolling deployments are supported');
  if ((service.deploymentConfiguration?.strategy ?? 'ROLLING') !== 'ROLLING') throw new Error('Only the ROLLING strategy is supported');
  const cb = service.deploymentConfiguration?.deploymentCircuitBreaker;
  if (!cb?.enable || !cb?.rollback) throw new Error('A must enable circuit breaker AND rollback in Terraform');
  if (service.deployments?.length !== 1 || service.deployments[0].rolloutState !== 'COMPLETED') throw new Error('Wait for a completed baseline deployment before CD');
  if (!task.requiresCompatibilities?.includes('FARGATE')) throw new Error('Expected a Fargate task definition');
  if ((task.runtimePlatform?.cpuArchitecture ?? 'X86_64') !== 'X86_64' || (task.runtimePlatform?.operatingSystemFamily ?? 'LINUX') !== 'LINUX') throw new Error('Images target linux/amd64; task platform must match');
  const containers = task.containerDefinitions.filter(c => c.name === target.container);
  if (containers.length !== 1 || containers[0].essential === false) throw new Error('Expected exactly one matching essential app container');
  if (!containers[0].healthCheck && !service.loadBalancers?.some(lb => lb.containerName === target.container)) throw new Error('Configure container or ALB health checks before CD');
}

export function renderTask(task, containerName, image) {
  // DescribeTaskDefinition includes read-only fields that RegisterTaskDefinition rejects.
  const allowed = ['family', 'taskRoleArn', 'executionRoleArn', 'networkMode', 'containerDefinitions',
    'volumes', 'placementConstraints', 'requiresCompatibilities', 'cpu', 'memory', 'pidMode',
    'ipcMode', 'proxyConfiguration', 'inferenceAccelerators', 'ephemeralStorage', 'runtimePlatform', 'enableFaultInjection'];
  const rendered = Object.fromEntries(allowed.filter(k => task[k] !== undefined).map(k => [k, structuredClone(task[k])]));
  const container = rendered.containerDefinitions.find(c => c.name === containerName);
  if (!container) throw new Error('App container missing');
  container.image = image;
  return rendered;
}

export function rolloutState(service, expectedArn) {
  const deployment = service.deployments?.find(d => d.taskDefinition === expectedArn);
  if (deployment?.rolloutState === 'FAILED') return 'failed';
  const primary = service.deployments?.find(d => d.status === 'PRIMARY');
  if (primary?.taskDefinition !== expectedArn) return 'different-primary';
  if (deployment?.rolloutState === 'COMPLETED' && service.taskDefinition === expectedArn &&
      service.deployments.length === 1 && service.pendingCount === 0 &&
      service.desiredCount > 0 && service.runningCount === service.desiredCount) return 'completed';
  return 'pending';
}

export async function deploy(serviceName, commit, {
  runAws = aws, config = loadTargets(), receipt,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  now = Date.now, timeoutMs = 30 * 60 * 1000,
} = {}) {
  requireService(serviceName);
  const target = config.services[serviceName];
  if (!target.enabled) return { service: serviceName, status: 'disabled', reason: 'Awaiting infrastructure handoff from A' };
  if (!SHA.test(commit ?? '') || receipt?.commit !== commit || receipt.service !== serviceName || !DIGEST.test(receipt.digest ?? '')) throw new Error('Receipt does not match this commit/service');
  const account = runAws(['sts', 'get-caller-identity']).Account;
  const uri = `${account}.dkr.ecr.${config.region}.amazonaws.com/${config.ecrPrefix}/${serviceName}`;
  if (receipt.image !== `${uri}@${receipt.digest}`) throw new Error('Receipt points outside the expected ECR repository');
  // Verify the immutable commit tag still resolves to the exact digest in this run's receipt.
  const ecr = runAws(['ecr', 'describe-images', '--repository-name', `${config.ecrPrefix}/${serviceName}`, '--image-ids', `imageTag=sha-${commit}`]);
  if (ecr.imageDetails?.[0]?.imageDigest !== receipt.digest) throw new Error('ECR digest does not match the build receipt');
  const describe = () => serviceFrom(runAws(['ecs', 'describe-services', '--cluster', config.cluster, '--services', target.service]));
  const before = describe();
  const task = runAws(['ecs', 'describe-task-definition', '--task-definition', before.taskDefinition]).taskDefinition;
  preflight(before, task, target);
  const record = { service: serviceName, commit, image: receipt.image, previousTaskDefinition: before.taskDefinition };
  if (task.containerDefinitions.find(c => c.name === target.container).image === receipt.image) {
    return { ...record, status: 'unchanged', taskDefinition: before.taskDefinition };
  }
  const started = now();
  const registered = runAws(['ecs', 'register-task-definition', '--cli-input-json', JSON.stringify(renderTask(task, target.container, receipt.image))]);
  const expected = registered.taskDefinition?.taskDefinitionArn;
  if (!expected) throw new Error('RegisterTaskDefinition did not return an ARN');
  runAws(['ecs', 'update-service', '--cluster', config.cluster, '--service', target.service, '--task-definition', expected]);
  let differentPrimary = 0;
  while (now() - started < timeoutMs) {
    await sleep(15000);
    const current = describe();
    const state = rolloutState(current, expected);
    if (state === 'completed') return { ...record, status: 'completed', taskDefinition: expected, elapsedSeconds: Math.round((now() - started) / 1000) };
    if (state === 'failed') throw new Error(`Deployment failed; circuit breaker may be rolling back. Expected ${expected}; previous ${before.taskDefinition}`);
    differentPrimary = state === 'different-primary' ? differentPrimary + 1 : 0;
    // Allow initial eventual consistency, but never report a healthy OLD revision as success.
    if (differentPrimary >= 4) throw new Error(`Rollback or concurrent deployment detected. Expected ${expected}; previous ${before.taskDefinition}`);
  }
  throw new Error(`Deployment timed out. Inspect ECS events; expected ${expected}; previous ${before.taskDefinition}. No forced rollback was issued.`);
}

if (isMain(import.meta.url)) {
  const service = process.argv[2];
  let result;
  try {
    const config = loadTargets();
    requireService(service);
    const receipt = config.services[service].enabled ? readJson(`receipts/${service}.json`) : undefined;
    result = await deploy(service, process.env.GITHUB_SHA, { config, receipt });
    summary(`${service}: ${result.status}${result.taskDefinition ? ` (${result.taskDefinition})` : ''}`);
  } catch (error) {
    result = { service, status: 'failed', message: error.message };
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    mkdirSync('deployment-results', { recursive: true });
    // Only write a filename after validating the service input.
    if (['ui', 'catalog', 'cart', 'checkout', 'orders'].includes(service)) writeFileSync(`deployment-results/${service}.json`, `${JSON.stringify(result, null, 2)}\n`);
  }
}
