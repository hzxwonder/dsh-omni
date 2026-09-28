import { homedir } from 'node:os'
import { join } from 'node:path'
import { PromptStore } from './store.js'

export const name = 'dsh-plugin-prompt'
export const inject = ['connection']

export function promptPath(env = process.env) {
  return join(env.DSH_HOME || join(homedir(), '.dsh'), 'desktop-prompts', 'prompts.json')
}

export async function handlePromptRequest(request, store) {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  const reply = (body, status = 200) => Response.json(body, { status, headers })
  if (request.method === 'GET') {
    try { return reply({ prompts: await store.list() }) }
    catch { return reply({ error: '提示词读取失败，请检查数据文件后重试。' }, 500) }
  }
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    return reply({ error: 'Expected application/json' }, 415)
  try {
    const raw = await request.text()
    if (Buffer.byteLength(raw) > 512_000) return reply({ error: '内容过长。' }, 413)
    const operation = JSON.parse(raw)
    return reply({ prompts: await store.change(operation) })
  } catch {
    return reply({ error: '保存失败：请检查名称是否重复、内容是否为空或过长，以及数据目录是否可写。' }, 400)
  }
}

export function apply(ctx, config = {}) {
  const store = new PromptStore(config.path ?? promptPath())
  ctx.connection.fetch.register({
    path: '/api/dsh-prompts',
    methods: ['GET', 'POST'],
    requestBody: 'buffered',
    fetch: request => handlePromptRequest(request, store),
  })
}
