import { mkdirSync, writeFileSync } from 'node:fs';
import { aws, DIGEST, SHA, isMain, loadSource, loadTargets, output, requireService, summary } from './common.mjs';

export function findImage(service, commit, runAws = aws) {
  requireService(service);
  if (!SHA.test(commit)) throw new Error('Image tag requires a full commit SHA');
  const config = loadTargets();
  const account = runAws(['sts', 'get-caller-identity']).Account;
  if (!/^\d{12}$/.test(account)) throw new Error('Unexpected AWS account');
  const registry = `${account}.dkr.ecr.${config.region}.amazonaws.com`;
  const repository = `${config.ecrPrefix}/${service}`;
  const tag = `sha-${commit}`;
  const image = runAws(['ecr', 'describe-images', '--repository-name', repository, '--image-ids', `imageTag=${tag}`], { allowMissingImage: true });
  const digest = image?.imageDetails?.[0]?.imageDigest;
  if (image && !DIGEST.test(digest ?? '')) throw new Error('ECR returned an invalid digest');
  return { service, commit, registry, repository, tag, digest: digest || '', uri: `${registry}/${repository}` };
}

if (isMain(import.meta.url)) {
  try {
    const [mode, service] = process.argv.slice(2);
    const result = findImage(service, process.env.GITHUB_SHA);
    if (mode === 'lookup') {
      output('exists', String(Boolean(result.digest)));
      output('registry', result.registry);
      output('tagged_image', `${result.uri}:${result.tag}`);
    } else if (mode === 'receipt') {
      if (!result.digest) throw new Error('Published image is missing');
      const source = loadSource(service);
      const receipt = {
        ...result, image: `${result.uri}@${result.digest}`, source,
        runId: process.env.GITHUB_RUN_ID,
        elapsedSeconds: Math.round((Date.now() - Number(process.env.JOB_STARTED_MS)) / 1000),
      };
      mkdirSync('receipts', { recursive: true });
      writeFileSync(`receipts/${service}.json`, `${JSON.stringify(receipt, null, 2)}\n`);
      summary(`${service}: published/reused ${receipt.image} (commit ${result.commit})`);
    } else throw new Error('Expected lookup or receipt');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
