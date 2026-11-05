import { readFileSync } from 'node:fs';
import { SERVICES, SHA, git, isMain, loadSource, loadTargets, output, summary } from './common.mjs';
import { successfulMainBase } from './github.mjs';

export function selectServices(paths) {
  const selected = new Set();
  for (const path of paths) {
    // Pipeline changes and target configuration must be exercised for all services.
    if (path === '.gitattributes' || /^(scripts\/ci\/|ci\/|\.github\/workflows\/(build|deploy)\.yml$)/.test(path)) return [...SERVICES];
    for (const service of SERVICES) {
      if (path === `app/services/${service}.json` || path.startsWith(`app/src/${service}/`)) selected.add(service);
    }
  }
  return SERVICES.filter(service => selected.has(service));
}

export function requestedServices(input) {
  if (input === 'all') return [...SERVICES];
  const selected = input.split(',').map(s => s.trim());
  if (!selected.length || selected.some(s => !SERVICES.includes(s))) throw new Error('Use all or a comma-separated list of known services');
  return SERVICES.filter(s => selected.includes(s));
}

export function eventChanges(event, eventName, head, successfulBase) {
  if (eventName === 'workflow_dispatch') return requestedServices(event.inputs?.services || 'all');
  const base = successfulBase ?? (eventName === 'pull_request' ? event.pull_request?.base?.sha : event.before);
  // A new branch / missing history must build everything, never silently skip work.
  if (!SHA.test(base ?? '') || /^0+$/.test(base)) return [...SERVICES];
  try {
    const range = eventName === 'pull_request' ? `${base}...${head}` : `${base}..${head}`;
    // --no-renames exposes both the removed and added paths for service moves.
    return selectServices(git('diff', '--name-only', '--no-renames', '-z', range).split('\0').filter(Boolean));
  } catch {
    summary('Base commit unavailable: building all five services.');
    return [...SERVICES];
  }
}

if (isMain(import.meta.url)) {
  try {
    loadTargets();
    SERVICES.forEach(loadSource);
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    let successfulBase;
    if (process.env.GITHUB_EVENT_NAME === 'push' && process.env.GITHUB_REF === 'refs/heads/main') {
      try {
        successfulBase = await successfulMainBase();
        // A rerun of an already successful commit should still exercise its original changes.
        if (successfulBase === process.env.GITHUB_SHA) successfulBase = event.before;
      } catch {
        successfulBase = '0'.repeat(40);
        summary('No accessible successful delivery baseline: selecting all services.');
      }
    }
    const selected = eventChanges(event, process.env.GITHUB_EVENT_NAME, process.env.GITHUB_SHA, successfulBase);
    const matrix = { include: selected.map(loadSource) };
    output('matrix', JSON.stringify(matrix));
    output('has_changes', String(selected.length > 0));
    summary(`Selected services: ${selected.join(', ') || 'none (documentation/infrastructure only)'}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
