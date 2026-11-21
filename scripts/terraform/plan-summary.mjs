// Pipe terraform show -json into stdin. Emit counts only for the PR description.
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

export function summarize(plan) {
  if (!/^1\./.test(plan?.format_version ?? '')) throw Error('Unsupported Terraform plan format');
  if (plan.errored) throw Error('Terraform reported a plan error');
  if (plan.resource_changes !== undefined && !Array.isArray(plan.resource_changes)) throw Error('Invalid resource_changes');
  const counts = { create: 0, update: 0, delete: 0, replace: 0, read: 0, forget: 0 };
  for (const resource of plan.resource_changes ?? []) {
    const action = resource.change?.actions?.join(',');
    if (action === 'no-op') continue;
    if (['create,delete', 'delete,create'].includes(action)) counts.replace++;
    else if (Object.hasOwn(counts, action)) counts[action]++;
    else throw Error('Unsupported Terraform action sequence');
  }
  const lines = ['### Terraform plan', '', '| Resource action | Count |', '|---|---:|'];
  for (const [action, count] of Object.entries(counts)) lines.push(`| ${action} | ${count} |`);
  if (plan.complete === false) lines.push('', 'Partial plan; additional changes may be deferred.');
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(summarize(JSON.parse(readFileSync(0, 'utf8')))); }
  catch { console.error('Cannot summarize this plan. Check the Terraform exit status and JSON format.'); process.exitCode = 1; }
}
