/** Validated same-origin transport for the prompt library. */
import { PROMPT_PATH, validatePrompt, type SavedPrompt } from '../prompt-contract.ts'
export interface PromptApi {
  list(): Promise<SavedPrompt[]>
  create(name: string, content: string): Promise<SavedPrompt[]>
  duplicate(name: string, content: string): Promise<SavedPrompt[]>
  update(id: string, name: string, content: string): Promise<SavedPrompt[]>
  delete(id: string): Promise<SavedPrompt[]>
  use(id: string): Promise<SavedPrompt[]>
}
export function createPromptApi(): PromptApi {
  const request = async (body?: object): Promise<SavedPrompt[]> => {
    let response: Response
    try {
      response = await fetch(PROMPT_PATH, {
        method: body ? 'POST' : 'GET', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
        headers: { Accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15_000),
      })
    } catch { throw new Error('暂时无法连接提示词服务，请稍后重试。') }
    if (response.status === 401 || response.status === 403) throw new Error('当前连接已失效，请重新打开 Desktop 后重试。')
    if (response.status === 404) throw new Error('提示词服务尚未就绪，请重新打开应用。')
    const text = await response.text()
    let result: { prompts?: unknown; error?: unknown }
    try { result = JSON.parse(text) as typeof result } catch { throw new Error('提示词服务返回异常，请重新打开 Desktop 后重试。') }
    if (!result || typeof result !== 'object') throw new Error('提示词数据读取异常，请重试。')
    if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : '操作未完成，请稍后重试。')
    if (!Array.isArray(result.prompts)) throw new Error('提示词数据读取异常，请重试。')
    for (const row of result.prompts) {
      if (!row || typeof row.id !== 'string' || !Number.isFinite(row.createdAt)
        || (row.lastUsedAt !== null && !Number.isFinite(row.lastUsedAt))) throw new Error('提示词数据读取异常，请重试。')
      validatePrompt(row.name, row.content)
    }
    return result.prompts as SavedPrompt[]
  }
  return { duplicate: (name, content) => request({ action: 'duplicate', name, content }), list: () => request(), create: (name, content) => request({ action: 'create', name, content }), update: (id, name, content) => request({ action: 'update', id, name, content }), delete: id => request({ action: 'delete', id }), use: id => request({ action: 'use', id }) }
}
