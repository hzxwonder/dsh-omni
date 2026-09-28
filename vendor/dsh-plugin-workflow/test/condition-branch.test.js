import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../lib/store.js';
import { Engine } from '../lib/engine.js';
import { validateDefinition } from '../lib/definition.js';

// 条件分支（本地表达式裁决，不经过模型）：条件为真只走「是」边，
// 为假只走「否」边，另一支不执行。模型裁决路径见 condition-judge.test.js。

async function setup(t) {
  const root = await mkdtemp(join(tmpdir(), 'wf-condbranch-'));
  const cwd = join(root, 'project');
  await mkdir(cwd);
  const store = new Store(join(root, 'data.sqlite'));
  const calls = [];
  const adapter = {
    rootRoute: () => ({ provider: 'local', model: 'test' }),
    route: async () => ({ provider: 'local', model: 'test' }),
    skills: async () => [],
    agent: async (node) => { calls.push(node.id); return { text: `${node.id}-ran` }; },
  };
  const engine = new Engine(store, adapter, join(root, 'artifacts'));
  const parent = { session: { id: 'root-session', header: { cwd } } };
  const start = (value) => engine.start({ workflowId: 'wf-branch', revision: 1, input: { text: value }, parent });
  t.after(async () => { await engine.close(); store.close(); await rm(root, { recursive: true, force: true }); });
  return { store, calls, start };
}

const definition = {
  schemaVersion: '1.0', id: 'wf-branch', name: '条件分流', trigger: 'manual',
  nodes: [
    { id: 'in', name: '输入', kind: 'input', prompt: 'material', input: { text: { source: 'workflow', path: '/text' } } },
    { id: 'judge', name: '判断', kind: 'condition', condition: { '==': [{ var: 'material' }, '开'] },
      input: { material: { source: 'workflow', path: '/text' } } },
    { id: 'yesStep', name: '是路径', kind: 'agent', prompt: 'x' },
    { id: 'noStep', name: '否路径', kind: 'agent', prompt: 'x' },
  ],
  edges: [
    { from: 'in', to: 'judge' },
    { from: 'judge', to: 'yesStep', on: 'true' },
    { from: 'judge', to: 'noStep', on: 'false' },
  ],
};

test('本地条件表达式为真 → 只走「是」边', async t => {
  validateDefinition(definition);
  const f = await setup(t);
  f.store.save(definition, 0);
  const run = await f.start('开');
  assert.equal(run.status, 'completed', run.error);
  assert.equal(run.outputs.judge.condition, true);
  assert.ok(f.calls.includes('yesStep'), '是路径应执行');
  assert.ok(!f.calls.includes('noStep'), '否路径应跳过');
});

test('本地条件表达式为假 → 只走「否」边', async t => {
  const f = await setup(t);
  f.store.save(definition, 0);
  const run = await f.start('关');
  assert.equal(run.status, 'completed', run.error);
  assert.equal(run.outputs.judge.condition, false);
  assert.ok(f.calls.includes('noStep'), '否路径应执行');
  assert.ok(!f.calls.includes('yesStep'), '是路径应跳过');
});

test('条件节点之外的边不允许携带 on 标记', () => {
  assert.throws(
    () => validateDefinition({ ...definition, edges: definition.edges.map(e => e.from === 'judge' ? { from: 'in', to: 'noStep', on: 'true' } : e) }),
    /CONDITION_EDGE_REQUIRED|DUPLICATE_EDGE|UNKNOWN_EDGE_NODE/,
  );
});
