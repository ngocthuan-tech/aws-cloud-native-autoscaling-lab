import { appendFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const SERVICES = ['ui', 'catalog', 'cart', 'checkout', 'orders'];
export const UPSTREAM = 'aws-containers/retail-store-sample-app';
export const SHA = /^[a-f0-9]{40}$/;
export const DIGEST = /^sha256:[a-f0-9]{64}$/;
export const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
export const isMain = url => process.argv[1] && url === pathToFileURL(process.argv[1]).href;
export function requireService(service) {
  if (!SERVICES.includes(service)) throw new Error(`Unknown service: ${service}`);
  return service;
}
export function output(key, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}
export function summary(message) {
  console.log(message);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
}
export function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 }).trimEnd();
}
export function loadSource(service) {
  requireService(service);
  const spec = readJson(`app/services/${service}.json`);
  if (spec.source === 'upstream' && SHA.test(spec.revision)) {
    return { service, source: 'upstream', revision: spec.revision, context: `upstream/src/${service}` };
  }
  if (spec.source === 'local' && !spec.revision) {
    return { service, source: 'local', revision: '', context: `app/src/${service}` };
  }
  throw new Error(`${service}: use source=upstream with a full commit SHA, or source=local without revision`);
}
export function loadTargets() {
  const config = readJson('ci/deploy-targets.json');
  if (config.region !== 'ap-southeast-1') throw new Error('Only Singapore is allowed');
  if (!/^[a-z0-9]+(?:[._/-][a-z0-9]+)*$/.test(config.ecrPrefix)) throw new Error('Invalid ECR prefix');
  if (!/^[a-zA-Z0-9_-]+$/.test(config.cluster)) throw new Error('Invalid ECS cluster');
  if (Object.keys(config.services).sort().join() !== [...SERVICES].sort().join()) throw new Error('Expected exactly five service targets');
  for (const [name, target] of Object.entries(config.services)) {
    if (typeof target.enabled !== 'boolean' || !/^[a-zA-Z0-9_-]+$/.test(target.container)) throw new Error(`Invalid target: ${name}`);
    if (typeof target.service !== 'string' || (target.enabled && !/^[a-zA-Z0-9_-]+$/.test(target.service))) throw new Error(`Missing ECS service name: ${name}`);
  }
  return config;
}
export function aws(args, { input, allowMissingImage = false } = {}) {
  try {
    const result = execFileSync('aws', [...args, '--region', 'ap-southeast-1', '--output', 'json', '--no-cli-pager'], {
      encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024,
    });
    return result.trim() ? JSON.parse(result) : {};
  } catch (error) {
    const stderr = error.stderr?.toString() ?? '';
    if (allowMissingImage && /\(ImageNotFoundException\)/.test(stderr)) return null;
    // Do not print task-definition input or credential-bearing CLI arguments.
    throw new Error(`AWS ${args[0]} ${args[1]} failed: ${stderr.slice(0, 1000)}`);
  }
}
