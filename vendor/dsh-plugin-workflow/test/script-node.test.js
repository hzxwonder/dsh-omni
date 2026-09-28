import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Engine } from '../lib/engine.js';
import { Store } from '../lib/store.js';
import { validateDefinition } from '../lib/definition.js';

const scriptNode = (code) => ({ id: 's', name: '脚本', kind: 'script', language: 'python', code, position: { x: 0, y: 0 } });

test('script node definition validates and requires code', () => {
  const def = { schemaVersion: '1.0', id: 'wf-script', name: '脚本工作流', trigger: 'manual', nodes: [scriptNode('print(input_data)')], edges: [] };
  validateDefinition(def);
  assert.throws(() => validateDefinition({ ...def, nodes: [{ id: 's', name: '脚本', kind: 'script' }] }), /CODE_REQUIRED/);
});

test('executeScript runs python with input_data and parses JSON output', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wf-script-'));
  const store = new Store(':memory:');
  const engine = new Engine(store, {}, join(dir, 'artifacts'));
  try {
    const out = await engine.executeScript(
      { kind: 'script', code: 'import json\nprint(json.dumps({"rev": input_data["text"][::-1]}))' },
      { text: 'abc' },
      AbortSignal.timeout(10000),
    );
    assert.equal(out.rev, 'cba');
  } finally {
    rmSync(dir, { recursive: true, force: true });
    store.close();
  }
});

test('executeScript reports script errors as SCRIPT_FAILED', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wf-script-err-'));
  const store = new Store(':memory:');
  const engine = new Engine(store, {}, join(dir, 'artifacts'));
  try {
    await assert.rejects(
      () => engine.executeScript({ kind: 'script', code: 'raise SystemExit(3)' }, AbortSignal.timeout(10000)),
      /SCRIPT_FAILED/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
    store.close();
  }
});
