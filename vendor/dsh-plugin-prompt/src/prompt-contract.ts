/** Desktop prompt library persisted under the active DSH Home. */
export const PROMPT_PATH = '/api/dsh-prompts'
export interface SavedPrompt {
  id: string
  name: string
  content: string
  createdAt: number
  lastUsedAt: number | null
}

export function validatePrompt(name: unknown, content: unknown): { name: string; content: string } {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
    throw new Error('名称不能为空，且不能超过 100 个字符。')
  }
  if (typeof content !== 'string' || !content.trim() || content.length > 100_000) {
    throw new Error('内容不能为空，且不能超过 100,000 个字符。')
  }
  return { name: name.trim(), content }
}
