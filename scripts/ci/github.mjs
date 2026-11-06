import { isMain, SHA } from './common.mjs';

export async function github(path, request = fetch) {
  const response = await request(`${process.env.GITHUB_API_URL || 'https://api.github.com'}/repos/${process.env.GITHUB_REPOSITORY}/${path}`, {
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
  return response.json();
}

export async function successfulMainBase(get = github) {
  const result = await get('actions/workflows/build.yml/runs?branch=main&event=push&status=success&per_page=1');
  const sha = result.workflow_runs?.[0]?.head_sha;
  if (!SHA.test(sha ?? '')) throw new Error('No successful main delivery exists yet');
  return sha;
}

export async function assertCurrentMain(expected, get = github) {
  const ref = await get('git/ref/heads/main');
  if (!SHA.test(expected ?? '') || ref.object?.sha !== expected) throw new Error('This run is not current main. Run Application delivery on main with services=all to recover.');
}

if (isMain(import.meta.url)) {
  try { await assertCurrentMain(process.env.GITHUB_SHA); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
