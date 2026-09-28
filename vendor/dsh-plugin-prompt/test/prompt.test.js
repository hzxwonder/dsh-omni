import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PromptStore } from '../store.js'
import { handlePromptRequest, promptPath } from '../index.js'

test('prompt data stays under the selected DSH home', () => {
  assert.equal(promptPath({ DSH_HOME: '/tmp/dsh-one' }), '/tmp/dsh-one/desktop-prompts/prompts.json')
})

test('create, duplicate, update, use and delete retain a valid atomic library', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-prompt-'))
  const path = join(root, 'prompts.json')
  try {
    const store = new PromptStore(path)
    const [first, second] = await Promise.all([
      store.change({ action: 'create', name: '研究综述', content: '归纳要点' }),
      store.change({ action: 'create', name: '审稿', content: '检查证据' }),
    ])
    assert.equal(first.length, 1)
    assert.equal(second.length, 2)
    const copied = await store.change({ action: 'duplicate', name: '研究综述', content: '归纳要点' })
    assert.equal(copied.at(-1).name, '研究综述 - copy')
    const id = copied[0].id
    await store.change({ action: 'update', id, name: '综述', content: '总结研究' })
    const used = await store.change({ action: 'use', id })
    assert.ok(used[0].lastUsedAt > 0)
    await store.change({ action: 'delete', id })
    assert.equal((await store.list()).length, 2)
    assert.equal(JSON.parse(await readFile(path, 'utf8')).length, 2)
    await assert.rejects(store.change({ action: 'create', name: '审稿', content: '重复' }), /已存在/)
    assert.equal((await store.list()).length, 2)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('API validates JSON and keeps the library available after a rejected change', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-prompt-api-'))
  try {
    const store = new PromptStore(join(root, 'prompts.json'))
    const post = body => new Request('http://localhost/api/dsh-prompts', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
    const failed = await handlePromptRequest(post({ action: 'create', name: '', content: 'x' }), store)
    assert.equal(failed.status, 400)
    const created = await handlePromptRequest(post({ action: 'create', name: '测试', content: '正文' }), store)
    assert.equal(created.status, 200)
    const listed = await handlePromptRequest(new Request('http://localhost/api/dsh-prompts'), store)
    assert.equal((await listed.json()).prompts[0].name, '测试')
  } finally { await rm(root, { recursive: true, force: true }) }
})
