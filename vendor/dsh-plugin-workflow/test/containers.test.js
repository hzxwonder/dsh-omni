import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../lib/store.js';
import { Engine } from '../lib/engine.js';
import { validateDefinition } from '../lib/definition.js';
import { renderPrompt } from '../lib/graph-edit.js';

async function setup(t, overrides = {}) {
  const root = await mkdtemp(join(tmpdir(), 'wf-containers-'));
  const cwd = join(root, 'project');
  await mkdir(cwd);
  const store = new Store(join(root, 'data.sqlite'));
  const calls = [];
  const adapter = {
    rootRoute: () => ({ provider: 'local', model: 'test' }),
    route: async n => ({ provider: 'local', model: 'test' }),
    skills: async () => [],
    agent: async (node, input) => { calls.push({ id: node.id, prompt: node.prompt, input }); return { text: `${node.id}<-${input.text ?? ''}` }; },
    ...overrides,
  };
  const engine = new Engine(store, adapter, join(root, 'artifacts'));
  const parent = { session: { id: 'root-session', header: { cwd } } };
  const start = (extra = {}) => engine.start({ workflowId: 'wf-shell', revision: 1, input: { text: 'material' }, parent, ...extra });
  t.after(async () => { await engine.close(); store.close(); await rm(root, { recursive: true, force: true }); });
  return { engine, store, parent, calls, start };
}

const baseDef = (containerProps, children) => ({
  schemaVersion: '1.0', id: 'wf-shell', name: '外壳工作流', trigger: 'manual',
  nodes: [
    { id: 'in', name: '输入', kind: 'input', prompt: 'material', input: { text: { source: 'workflow', path: '/text' } } },
    { id: 'shell', name: '外壳', kind: containerProps.kind, input: {}, ...containerProps },
    ...children.map(c => ({ ...c, parentId: 'shell' })),
  ],
  edges: [{ from: 'in', to: 'shell' }],
});

test('multithread runs agent children concurrently and distributes the container prompt', async t => {
  let concurrent = 0, peak = 0;
  const f = await setup(t, { agent: async (node, input) => {
    concurrent++; peak = Math.max(peak, concurrent);
    await new Promise(r => setTimeout(r, 150));
    concurrent--;
    return { text: `${node.id}:${node.prompt}:${input.text}` };
  } });
  const def = baseDef({ kind: 'multithread', concurrency: 2, distributePrompt: true, prompt: '统一指令' }, [
    { id: 'a', name: 'A', kind: 'agent', prompt: 'should be overridden' },
    { id: 'b', name: 'B', kind: 'agent', prompt: 'should be overridden' },
  ]);
  validateDefinition(def);
  f.store.save(def, 0);
  const run = await f.start({ input: { text: 'material' } });
  assert.equal(run.status, 'completed', run.error);
  assert.equal(peak, 2, '两个子步骤应并发执行');
  assert.ok(f.calls.every(c => c.prompt === '统一指令'), '分发 Prompt 应覆盖子步骤 Prompt');
  assert.match(run.outputs['shell'].text, /【A】/);
  assert.match(run.outputs['shell'].text, /【B】/);
});

test('child references to upstream nodes outside the shell resolve at container execution', async t => {
  const f = await setup(t);
  const def = {
    schemaVersion: '1.0', id: 'wf-shell', name: '外壳工作流', trigger: 'manual',
    nodes: [
      { id: 'in', name: '输入', kind: 'input', prompt: 'material', input: { text: { source: 'workflow', path: '/text' } } },
      { id: 'writer', name: '撰写', kind: 'agent', prompt: '写一句话', input: { text: { source: 'workflow', path: '/text' } } },
      { id: 'shell', name: '外壳', kind: 'multithread', concurrency: 2, distributePrompt: false, input: {} },
      { id: 'child', name: '子步骤', kind: 'agent', parentId: 'shell',
        prompt: '汇总：{{input.request}}',
        input: { request: { source: 'node', nodeId: 'in', path: '/text' } } },
    ],
    edges: [
      { from: 'in', to: 'writer' },
      { from: 'writer', to: 'shell' },
      { from: 'in', to: 'child' },
    ],
  };
  validateDefinition(def);
  f.store.save(def, 0);
  const run = await f.start({ input: { text: 'material' } });
  assert.equal(run.status, 'completed', run.error);
  const childCall = f.calls.find(c => c.id === 'child');
  assert.ok(childCall, '子步骤应被执行');
  assert.equal(childCall.input.request, 'material', '子步骤引用的外壳外上游输出应解析进容器输入');
  assert.equal(renderPrompt(childCall.prompt, childCall.input), '汇总："material"');
});

test('empty shells are skipped instead of failing the run', async t => {
  const f = await setup(t);
  const def = baseDef({ kind: 'multithread', concurrency: 3, distributePrompt: true, prompt: 'p' }, []);
  validateDefinition(def);
  f.store.save(def, 0);
  const run = await f.start({ input: { text: 'material' } });
  assert.equal(run.status, 'completed', run.error);
  assert.equal(run.outputs['shell'].skipped, true);
  assert.equal(f.calls.length, 0, '空外壳不应调用任何子代理');
});

test('container validation rejects nesting, wrong child kinds and missing prompt', () => {
  const shell = { id: 'shell', name: '外壳', kind: 'multithread', concurrency: 3, distributePrompt: true, prompt: 'p' };
  const child = { id: 'a', name: 'A', kind: 'agent', prompt: 'x' };
  const def = (nodes) => ({ schemaVersion: '1.0', id: 'wf-shell', name: 'x', trigger: 'manual', nodes, edges: [] });
  validateDefinition(def([shell, child]));
  // 嵌套容器：multithread 只收 agent 子节点，先报 CHILD_KIND
  assert.throws(() => validateDefinition(def([shell, child, { id: 'inner', name: '内', kind: 'multithread', concurrency: 1, parentId: 'shell' }])), /CONTAINER_(CHILD_KIND|NESTED)/);
  // multithread 子步骤必须是 agent
  assert.throws(() => validateDefinition(def([shell, { id: 'in2', name: '输入', kind: 'input', parentId: 'shell' }])), /CONTAINER_CHILD_KIND/);
  // 勾选分发但容器无 Prompt
  assert.throws(() => validateDefinition(def([{ ...shell, prompt: '' }, child])), /PROMPT_REQUIRED/);
  // loop-shell / branch-shell 已下线：schema 拒绝该 kind
  assert.throws(() => validateDefinition(def([{ id: 'l', name: '循环外壳', kind: 'loop-shell', rounds: 2 }])));
  // loop 节点已下线：循环由条件与 agent repeat 组合实现，schema 拒绝该 kind
  assert.throws(() => validateDefinition(def([{ id: 'lp', name: '循环', kind: 'loop', maxItems: 5, workflow: { id: 'w', revision: 1 } }])));
});
