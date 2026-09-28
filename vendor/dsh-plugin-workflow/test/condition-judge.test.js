import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../lib/store.js';
import { Engine } from '../lib/engine.js';
import { validateDefinition } from '../lib/definition.js';

async function setup(t, judgeAnswer) {
  const root = await mkdtemp(join(tmpdir(), 'wf-condjudge-'));
  const cwd = join(root, 'project');
  await mkdir(cwd);
  const store = new Store(join(root, 'data.sqlite'));
  const calls = [];
  const adapter = {
    rootRoute: () => ({ provider: 'local', model: 'test' }),
    route: async () => ({ provider: 'local', model: 'test' }),
    skills: async () => [],
    agent: async (node, input) => {
      calls.push({ id: node.id, prompt: node.prompt, input, schema: node.outputSchema ?? null });
      if (node.id === 'judge') {
        if (judgeAnswer === 'invalid') return { text: '无法判断' };
        return { answer: judgeAnswer === '是', reason: '测试依据' };
      }
      return { text: `${node.id}-ran` };
    },
  };
  const engine = new Engine(store, adapter, join(root, 'artifacts'));
  const parent = { session: { id: 'root-session', header: { cwd } } };
  const start = () => engine.start({ workflowId: 'wf-judge', revision: 1, input: { text: '材料' }, parent });
  t.after(async () => { await engine.close(); store.close(); await rm(root, { recursive: true, force: true }); });
  return { store, calls, start };
}

const def = {
  schemaVersion: '1.0', id: 'wf-judge', name: '判断框', trigger: 'manual',
  nodes: [
    { id: 'in', name: '输入', kind: 'input', prompt: 'material', input: { text: { source: 'workflow', path: '/text' } } },
    { id: 'judge', name: '判断', kind: 'condition', prompt: '材料是否包含「材料」二字？只回答是或否。',
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

test('condition with prompt is judged via structured output (answer:true → 是路径)', async t => {
  const f = await setup(t, '是');
  validateDefinition(def);
  f.store.save(def, 0);
  const run = await f.start();
  assert.equal(run.status, 'completed', run.error);
  assert.equal(run.outputs['judge'].condition, true);
  assert.equal(run.outputs['judge'].answer, true);
  assert.equal(run.outputs['judge'].reason, '测试依据');
  const judgeCall = f.calls.find(c => c.id === 'judge');
  assert.equal(judgeCall.schema?.properties?.answer?.type, 'boolean', '条件裁决应携带结构化 outputSchema');
  assert.ok(f.calls.some(c => c.id === 'yesStep'), '是路径应执行');
  assert.ok(!f.calls.some(c => c.id === 'noStep'), '否路径应跳过');
});

test('structured judge answers false → 否路径', async t => {
  const f = await setup(t, '否');
  f.store.save(def, 0);
  const run = await f.start();
  assert.equal(run.status, 'completed', run.error);
  assert.equal(run.outputs['judge'].condition, false);
  assert.ok(!f.calls.some(c => c.id === 'yesStep'));
  assert.ok(f.calls.some(c => c.id === 'noStep'));
});

test('non-JSON judge answer falls back to text parsing (否 → false)', async t => {
  const f = await setup(t, 'invalid');
  f.store.save(def, 0);
  const run = await f.start();
  assert.equal(run.status, 'completed', run.error);
  assert.equal(run.outputs['judge'].condition, false);
  assert.ok(f.calls.some(c => c.id === 'noStep'));
});

test('condition without prompt still requires a condition expression', () => {
  validateDefinition({ ...def, nodes: def.nodes.map(n => n.id === 'judge' ? { ...n, condition: { '!!': [{ var: 'text' }] } } : n) });
  assert.throws(() => validateDefinition({ ...def, nodes: def.nodes.map(n => n.id === 'judge' ? { ...n, prompt: '' } : n) }), /CONDITION_REQUIRED/);
});
