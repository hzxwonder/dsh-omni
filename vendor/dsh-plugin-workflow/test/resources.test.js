import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { WorkflowResources, renderSkill, validateResources } from '../lib/resources.js';
import { Store } from '../lib/store.js';
import { Engine } from '../lib/engine.js';
import { buildAgentPrompt, stepTools } from '../lib/harness.js';
import { connectReference } from '../lib/graph-edit.js';

const definition = () => ({ schemaVersion: '1.0', id: 'resource-flow', name: '资源流程', nodes: [
  { id: 'skill', kind: 'skill', name: '资料核验', skill: { name: 'evidence-check', description: '核对证据并写出来源。', instructions: '按来源逐条核对。', files: [{ path: 'references/rules.md', content: '只使用可靠来源。' }] } },
  { id: 'file', kind: 'file', name: '材料', file: { name: 'paper.txt', content: 'PRIVATE_FILE_BODY' } },
  { id: 'agent', kind: 'agent', name: '分析', prompt: '使用 {{input.skill}} 阅读 {{input.file}}', tools: [], input: {} },
], edges: [] });

test('Skill 和文件按修订版落盘，下游只收到路径，Skill 正文按需加载', async t => {
  const root = await mkdtemp(join(tmpdir(), 'wf-resources-'));
  const workspaces = join(root, 'workflows');
  const cwd = join(workspaces, 'resource-flow');
  await mkdir(cwd, { recursive: true });
  const store = new Store(join(root, 'db.sqlite'));
  const resources = new WorkflowResources(workspaces, root);
  const calls = [];
  const adapter = {
    rootRoute: () => ({ provider: 'test', model: 'test' }), route: async () => ({}), skills: async () => [],
    agent: async (node, input, _route, skills) => {
      const prompt = buildAgentPrompt(node, input, skills)[0].text;
      calls.push({ input, skills, prompt });
      return { text: '完成' };
    },
  };
  const engine = new Engine(store, adapter, join(root, 'artifacts'), resources);
  t.after(async () => { await engine.close(); store.close(); await rm(root, { recursive: true, force: true }); });
  let def = definition();
  def = connectReference(def, 'skill', 'agent', false).definition;
  def = connectReference(def, 'file', 'agent', false).definition;
  store.save(def);
  const first = store.get('revision', 'resource-flow:1');
  const paths = await resources.materialize(first);
  assert.match(await readFile(join(paths.skill, 'SKILL.md'), 'utf8'), /name: evidence-check/);
  assert.equal(await readFile(join(paths.skill, 'references/rules.md'), 'utf8'), '只使用可靠来源。');
  assert.equal(await readFile(paths.file, 'utf8'), 'PRIVATE_FILE_BODY');
  const run = await engine.start({ workflowId: def.id, revision: 1, input: {}, parent: { session: { id: 's1', header: { cwd } } } });
  assert.equal(run.status, 'completed', run.error);
  assert.equal(calls[0].input.file, paths.file);
  assert.equal(calls[0].input.skill, paths.skill);
  assert.match(calls[0].prompt, /按来源逐条核对/);
  assert.match(calls[0].prompt, /paper\.txt/);
  assert.doesNotMatch(calls[0].prompt, /PRIVATE_FILE_BODY/);
  assert(stepTools(def.nodes[2]).includes('read'));
  def.nodes[1].file.content = '第二版';
  store.save(def, 1);
  const second = await resources.materialize(store.get('revision', 'resource-flow:2'));
  assert.equal(await readFile(paths.file, 'utf8'), 'PRIVATE_FILE_BODY');
  assert.equal(await readFile(second.file, 'utf8'), '第二版');
});

test('资源路径和 Skill 结构通过校验', async t => {
  const root = await mkdtemp(join(tmpdir(), 'wf-resource-validation-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const resources = new WorkflowResources(join(root, 'workflows'), root);
  const def = definition();
  const uploaded = await resources.upload(Buffer.from('binary bytes').toString('base64'));
  def.nodes[1].file = { name: 'data.bin', ...uploaded };
  await resources.verifyBlobs(def);
  assert.match(renderSkill(def.nodes[0].skill), /^---\nname: evidence-check\ndescription:/);
  def.nodes[0].skill.files[0].path = 'references/../escape.md';
  assert.throws(() => validateResources(def), /RESOURCE_PATH_INVALID/);
});
