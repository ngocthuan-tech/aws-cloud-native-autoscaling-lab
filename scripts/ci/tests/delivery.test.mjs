import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { SERVICES, loadSource, loadTargets } from '../common.mjs';
import { eventChanges, requestedServices, selectServices } from '../select-services.mjs';
import { findImage } from '../ecr-image.mjs';
import { deploy, preflight, renderTask, rolloutState, serviceFrom } from '../deploy-service.mjs';
import { assertCurrentMain, successfulMainBase } from '../github.mjs';

const commit = 'a'.repeat(40);
const digest = `sha256:${'b'.repeat(64)}`;
const oldArn = 'arn:aws:ecs:ap-southeast-1:123456789012:task-definition/ui:1';
const newArn = 'arn:aws:ecs:ap-southeast-1:123456789012:task-definition/ui:2';
const task = {
  family: 'ui', taskDefinitionArn: oldArn, revision: 1, status: 'ACTIVE',
  requiresCompatibilities: ['FARGATE'], cpu: '256', memory: '512',
  executionRoleArn: 'execution-role', taskRoleArn: 'task-role',
  containerDefinitions: [
    { name: 'ui', image: 'old-image', essential: true, healthCheck: { command: ['CMD', 'true'] }, environment: [{ name: 'ENDPOINT', value: 'preserved' }] },
    { name: 'sidecar', image: 'sidecar-original' },
  ],
};
const baseline = {
  status: 'ACTIVE', desiredCount: 1, runningCount: 1, pendingCount: 0, taskDefinition: oldArn,
  deploymentController: { type: 'ECS' },
  deploymentConfiguration: { deploymentCircuitBreaker: { enable: true, rollback: true } },
  deployments: [{ status: 'PRIMARY', taskDefinition: oldArn, rolloutState: 'COMPLETED' }],
};
const completed = {
  ...baseline, taskDefinition: newArn,
  deployments: [{ status: 'PRIMARY', taskDefinition: newArn, rolloutState: 'COMPLETED' }],
};
const config = {
  region: 'ap-southeast-1', ecrPrefix: 'group14-capstone', cluster: 'group14-capstone-cluster',
  services: { ...Object.fromEntries(SERVICES.map(s => [s, { enabled: false, service: '', container: s }])), ui: { enabled: true, service: 'group14-ui', container: 'ui' } },
};
const receipt = {
  service: 'ui', commit, digest,
  image: `123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/group14-capstone/ui@${digest}`,
};

test('docs and infrastructure edits select no app services', () => {
  assert.deepEqual(selectServices(['README.md', 'docs/note-c.md', 'infra/terraform/ecs.tf']), []);
});
test('a Cart source or version edit selects Cart only', () => {
  assert.deepEqual(selectServices(['app/src/cart/src/Main.java', 'app/services/cart.json']), ['cart']);
});
test('a cross-service rename selects the old and new services', () => {
  assert.deepEqual(selectServices(['app/src/cart/file', 'app/src/orders/file']), ['cart', 'orders']);
});
test('shared pipeline edits select all services', () => {
  for (const path of ['scripts/ci/deploy-service.mjs', 'ci/deploy-targets.json', '.github/workflows/build.yml', '.github/workflows/deploy.yml']) assert.deepEqual(selectServices([path]), SERVICES);
});
test('manual recovery accepts only known services', () => {
  assert.deepEqual(requestedServices('orders, ui,ui'), ['ui', 'orders']);
  assert.deepEqual(requestedServices('all'), SERVICES);
  for (const bad of ['', 'unknown', 'ui,', 'ui;echo bad']) assert.throws(() => requestedServices(bad));
});
test('successful-main baseline validates the API response and stale runs are rejected', async () => {
  assert.equal(await successfulMainBase(async () => ({ workflow_runs: [{ head_sha: commit }] })), commit);
  await assert.rejects(successfulMainBase(async () => ({ workflow_runs: [] })));
  await assertCurrentMain(commit, async () => ({ object: { sha: commit } }));
  await assert.rejects(assertCurrentMain(commit, async () => ({ object: { sha: 'c'.repeat(40) } })), /current main/);
});
test('new branch and missing diff history fail safe to all services', () => {
  assert.deepEqual(eventChanges({ before: '0'.repeat(40) }, 'push', commit), SERVICES);
  assert.deepEqual(eventChanges({ before: 'f'.repeat(40) }, 'push', commit), SERVICES);
});
test('PR changes use merge base, including deletions and renames', () => {
  const dir = mkdtempSync(join(tmpdir(), 'group14-diff-'));
  const original = process.cwd();
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    git('init'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
    mkdirSync(join(dir, 'app/src/cart'), { recursive: true });
    writeFileSync(join(dir, 'app/src/cart/old.txt'), 'content');
    git('add', '.'); git('commit', '-m', 'baseline');
    const base = git('rev-parse', 'HEAD');
    git('switch', '-c', 'feature');
    mkdirSync(join(dir, 'app/src/orders'), { recursive: true });
    git('mv', 'app/src/cart/old.txt', 'app/src/orders/new.txt');
    git('commit', '-m', 'move');
    const head = git('rev-parse', 'HEAD');
    process.chdir(dir);
    assert.deepEqual(eventChanges({ pull_request: { base: { sha: base } } }, 'pull_request', head), ['cart', 'orders']);
    writeFileSync(join(dir, 'README.md'), 'documentation after failed deployment');
    git('add', '.'); git('commit', '-m', 'docs');
    const next = git('rev-parse', 'HEAD');
    assert.deepEqual(eventChanges({ before: head }, 'push', next), []);
    assert.deepEqual(eventChanges({ before: head }, 'push', next, base), ['cart', 'orders']);
  } finally {
    process.chdir(original);
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep + 'group14-diff-')) throw new Error('Unsafe fixture cleanup path');
    rmSync(dir, { recursive: true, force: true });
  }
});
test('repository contract has five valid source specs and Singapore targets', () => {
  for (const name of SERVICES) {
    const source = loadSource(name);
    if (source.source === 'upstream') {
      assert.equal(source.revision.length, 40);
      assert.equal(source.context, `upstream/src/${name}`);
    } else {
      assert.equal(source.context, `app/src/${name}`);
    }
  }
  assert.equal(loadTargets().region, 'ap-southeast-1');
});
test('ECR retry reuses an existing immutable digest', () => {
  const result = findImage('ui', commit, args => args[0] === 'sts' ? { Account: '123456789012' } : { imageDetails: [{ imageDigest: digest }] });
  assert.equal(result.digest, digest);
  assert.equal(result.tag, `sha-${commit}`);
});
test('ECR missing image means build, but AccessDenied remains an error', () => {
  assert.equal(findImage('ui', commit, args => args[0] === 'sts' ? { Account: '123456789012' } : null).digest, '');
  assert.throws(() => findImage('ui', commit, () => { throw new Error('AccessDenied'); }), /AccessDenied/);
});
test('render replaces only the selected image and strips read-only API fields', () => {
  const result = renderTask(task, 'ui', receipt.image);
  assert.equal(result.containerDefinitions[0].image, receipt.image);
  assert.equal(result.containerDefinitions[1].image, 'sidecar-original');
  assert.deepEqual(result.containerDefinitions[0].environment, task.containerDefinitions[0].environment);
  assert.equal(result.taskDefinitionArn, undefined);
  assert.equal(result.revision, undefined);
  assert.equal(task.containerDefinitions[0].image, 'old-image');
});
test('preflight accepts the healthy Fargate baseline', () => preflight(baseline, task, config.services.ui));
test('preflight rejects disabled rollback, ongoing deployment and zero desired count', () => {
  for (const change of [
    { deploymentConfiguration: { deploymentCircuitBreaker: { enable: true, rollback: false } } },
    { deployments: [{ rolloutState: 'IN_PROGRESS' }] },
    { desiredCount: 0 }, { deploymentController: { type: 'CODE_DEPLOY' } },
  ]) assert.throws(() => preflight({ ...baseline, ...change }, task, config.services.ui));
});
test('preflight rejects ARM images mismatch and missing health checks', () => {
  assert.throws(() => preflight(baseline, { ...task, runtimePlatform: { cpuArchitecture: 'ARM64' } }, config.services.ui));
  const noHealth = structuredClone(task);
  delete noHealth.containerDefinitions[0].healthCheck;
  assert.throws(() => preflight(baseline, noHealth, config.services.ui), /health/);
  preflight({ ...baseline, loadBalancers: [{ containerName: 'ui' }] }, noHealth, config.services.ui);
});
test('healthy rollback is never reported as success for the new revision', () => {
  assert.equal(rolloutState(baseline, newArn), 'different-primary');
  assert.equal(rolloutState(completed, newArn), 'completed');
  assert.equal(rolloutState({ ...completed, pendingCount: 1 }, newArn), 'pending');
});
test('DescribeServices API failures cannot silently pass', () => {
  assert.throws(() => serviceFrom({ services: [], failures: [{ reason: 'MISSING' }] }));
});

function mockAws(sequence = [completed]) {
  const calls = [];
  let describes = 0;
  const runAws = args => {
    calls.push(args);
    switch (`${args[0]} ${args[1]}`) {
      case 'sts get-caller-identity': return { Account: '123456789012' };
      case 'ecr describe-images': return { imageDetails: [{ imageDigest: digest }] };
      case 'ecs describe-services': return { services: [describes++ === 0 ? baseline : sequence[Math.min(describes - 2, sequence.length - 1)]] };
      case 'ecs describe-task-definition': return { taskDefinition: task };
      case 'ecs register-task-definition': return { taskDefinition: { taskDefinitionArn: newArn } };
      case 'ecs update-service': return {};
      default: throw new Error('Unexpected AWS call');
    }
  };
  let clock = 0;
  return { calls, options: { config, receipt, runAws, sleep: async ms => { clock += ms; }, now: () => clock, timeoutMs: 90000 } };
}
test('disabled target performs zero AWS calls', async () => {
  const disabled = structuredClone(config);
  disabled.services.ui.enabled = false;
  const result = await deploy('ui', commit, { config: disabled, runAws: () => { throw new Error('must not call AWS'); } });
  assert.equal(result.status, 'disabled');
});
test('successful deployment registers a revision, updates only the intended service and verifies it', async () => {
  const mock = mockAws();
  const result = await deploy('ui', commit, mock.options);
  assert.equal(result.status, 'completed');
  assert.equal(result.taskDefinition, newArn);
  const update = mock.calls.find(args => args[1] === 'update-service');
  assert.equal(update[update.indexOf('--service') + 1], 'group14-ui');
  assert.equal(update.includes('--desired-count'), false);
});
test('wrong receipt commit or digest is rejected before ECS mutation', async () => {
  for (const bad of [{ ...receipt, commit: 'c'.repeat(40) }, { ...receipt, image: 'foreign/image@' + digest }, { ...receipt, digest: `sha256:${'e'.repeat(64)}`, image: receipt.image.replace(digest, `sha256:${'e'.repeat(64)}`) }]) {
    const mock = mockAws();
    await assert.rejects(deploy('ui', commit, { ...mock.options, receipt: bad }));
    assert.equal(mock.calls.some(args => args[1] === 'register-task-definition'), false);
  }
});
test('rollback to a healthy old revision fails the deployment job', async () => {
  const mock = mockAws([baseline]);
  await assert.rejects(deploy('ui', commit, mock.options), /Rollback/);
});
test('failed rollout and timeout both fail without disabling circuit breaker', async () => {
  const failed = { ...completed, deployments: [{ ...completed.deployments[0], rolloutState: 'FAILED' }] };
  await assert.rejects(deploy('ui', commit, mockAws([failed]).options), /Deployment failed/);
  const pending = { ...completed, deployments: [{ ...completed.deployments[0], rolloutState: 'IN_PROGRESS' }] };
  await assert.rejects(deploy('ui', commit, mockAws([pending]).options), /timed out/);
});
