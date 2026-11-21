import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from './plan-summary.mjs';

test('counts actions and replacements without exposing values', () => {
  const actions = [['delete','create'], ['create','delete'], ['update'], ['read'], ['no-op']];
  const md = summarize({ format_version:'1.2', resource_changes: actions.map(actions => ({change:{actions, after:{value:'private-example'}}})) });
  assert.match(md, /replace \| 2/);
  assert.match(md, /update \| 1/);
  assert.match(md, /read \| 1/);
  assert.doesNotMatch(md, /private-example/);
});

test('accepts empty resource changes and marks incomplete plans', () => {
  assert.match(summarize({format_version:'1.2'}), /create \| 0/);
  assert.match(summarize({format_version:'1.2',complete:false}), /Partial/);
});

test('rejects failed, malformed and unsupported plans', () => {
  for (const p of [{errored:true},{resource_changes:{}},{resource_changes:[{change:{actions:['unknown']}}]}]) {
    assert.throws(() => summarize({format_version:'1.2',...p}));
  }
  assert.throws(() => summarize({format_version:'2.0'}));
});
