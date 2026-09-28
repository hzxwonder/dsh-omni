import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectPaperSkill, reviewedPaperTemplate } from '../lib/paper-workflow.js';
import { validateDefinition } from '../lib/definition.js';
import { Engine } from '../lib/engine.js';
import { Store } from '../lib/store.js';
import { WorkflowResources } from '../lib/resources.js';
import { buildAgentPrompt, stepTools } from '../lib/harness.js';

test('four-stage paper workflow revises, isolates reader input, exports article and publishes once', async t => {
  const root = await mkdtemp('/private/tmp/paper-workflow-'); const cwd = join(root, 'project'); await mkdir(cwd);
  const store = new Store(join(root, 'data.sqlite')); const d = reviewedPaperTemplate(); validateDefinition(d); store.save(d);
  const resources = new WorkflowResources(join(root, 'workflows'), root);
  let round = 0, publications = 0; const calls = []; let skillPath;
  const adapter = {
    rootRoute: () => ({ provider: 'fixture', model: 'fixture' }), route: async () => ({ provider: 'fixture', model: 'fixture' }), skills: async () => [],
    agent: async (node, input, _route, skills) => {
      calls.push(node.id);
      if (node.id === 'source') return { text: 'ORIGINAL_PRIVATE_MARKER ' + ('Section 3 describes a concrete method; Section 5 provides measured comparisons. ').repeat(8), title: 'Paper', sourceUrl: 'https://example.org/paper', complete: true };
      if (node.id === 'article') {
        assert.equal(skills[0]?.name, 'paper-explainer');
        assert.equal(input.paper_skill, skills[0].path);
        assert(buildAgentPrompt(node, input, skills)[0].text.includes(input.paper_skill));
        skillPath = input.paper_skill;
        return { title: 'Paper explained', slug: 'paper-explained', text: ('Clear reader article with one concrete example. ').repeat(8), overview: { title: 'Paper logic', steps: [
        { label: 'Problem', title: 'A real bottleneck', detail: 'Measure the bottleneck.' },
        { label: 'Method', title: 'A concrete choice', detail: 'Choose an approach.' },
        { label: 'Mechanism', title: 'How it works', detail: 'Follow the data.' },
        { label: 'Result', title: 'Observed outcome', detail: 'Compare against baseline.' },
      ], evidence: 'The experiment reports a measured result.', boundary: 'The setup limits generalization.' } };
      }
      if (node.id === 'ask') return { text: 'Explain the example.' };
      if (node.id === 'answer') { assert(!JSON.stringify(input).includes('ORIGINAL_PRIVATE_MARKER')); assert.deepEqual(Object.keys(input).sort(), ['article', 'questions']); return { text: 'The article explains the example.' }; }
      if (node.id === 'judge') return { score: ++round === 1 ? 70 : 92, text: 'Evidence and reader understanding checked.' };
      throw Error('unexpected aggregator call');
    },
    publish: async input => { publications++; assert.equal(input.review.score, 92); return { status: 'published', url: 'https://example.org/paper-explained' }; },
  };
  const engine = new Engine(store, adapter, join(root, 'artifacts'), resources);
  t.after(async () => { await engine.close(); store.close(); await rm(root, { recursive: true, force: true }); });
  const run = await engine.start({ workflowId: d.id, revision: 1, input: { text: 'uploaded paper' }, parent: { session: { id: 'fixture', header: { cwd } } } });
  assert.equal(run.status, 'completed', run.error); assert.equal(publications, 1); assert.equal(round, 2);
  assert.equal(calls.filter(id => id === 'source').length, 1);
  assert.equal(calls.filter(id => id === 'article').length, 2);
  assert.equal(run.nodes.paper_skill.status, 'completed');
  assert(skillPath);
  assert.match(await readFile(join(skillPath, 'SKILL.md'), 'utf8'), /^---\nname: paper-explainer/m);
  assert.match(await readFile(join(skillPath, 'references/article-template.md'), 'utf8'), /论文信息/);
  assert.equal(store.list('artifact').length, 2);
  assert((await readFile(store.list('artifact')[0].path, 'utf8')).includes('concrete example'));
});


test('paper Skill is a connected, versioned resource for the writing step', async t => {
 const root = await mkdtemp('/private/tmp/paper-skill-');
 const d = reviewedPaperTemplate();
 t.after(() => rm(root, { recursive: true, force: true }));
 assert(d.edges.some(edge => edge.from === 'paper_skill' && edge.to === 'article'));
 const article = d.nodes.find(node => node.id === 'article');
 assert.equal(article.skills.includes('paper-explainer'), false);
 assert.equal(article.input.paper_skill.resourceKind, 'skill');
 assert(article.prompt.includes('{{input.paper_skill}}'));
 assert(stepTools(article).includes('read'));
 assert.deepEqual(connectPaperSkill(d), d);
 const store = new Store(join(root, 'data.sqlite'));
 t.after(() => store.close());
 store.save(d);
 const resources = new WorkflowResources(join(root, 'workflows'), root);
 const engine = new Engine(store, { route: async () => ({}), skills: async () => [] }, join(root, 'artifacts'), resources);
 t.after(() => engine.close());
 const prepared = await engine.prepare(store.get('revision', 'paper-reader:1'), {}, {}, AbortSignal.timeout(1000));
 assert.equal(prepared.skills.article[0].name, 'paper-explainer');
 assert.equal(prepared.skills.article[0].path, prepared.resources.paper_skill);
 const prompt = buildAgentPrompt(article, { paper_skill: prepared.resources.paper_skill }, prepared.skills.article)[0].text;
 assert(prompt.includes(prepared.resources.paper_skill));
 assert(prompt.includes('## 写作判断'));
});
