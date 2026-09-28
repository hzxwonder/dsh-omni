/** Saved prompts complete directly in the Harness composer menu. */
import type { Context } from '@deepseek-ai/cordis'
import type { InputTriggerSource, ClientSessionContext } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import { createRoot } from 'react-dom/client'
import { createPromptApi, PromptLibrary } from './PromptLibrary.tsx'
import type { SavedPrompt } from '../prompt-contract.ts'

export const name = 'dsh-plugin-prompt'
export const inject = ['inputTriggers', 'conversation', 'sessions']

export function apply(ctx: Context): void {
  let close: (() => void) | undefined
  const api = createPromptApi()
  const open = ({ sessionId }: ClientSessionContext) => {
    close?.()
    const scope = ctx.sessions.scope(sessionId)
    if (!scope) return
    const input = ctx.conversation.input.for(scope)
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const previousFocus = document.activeElement
    let active = true
    const dispose = () => {
      if (!active) return
      active = false; root.unmount(); container.remove()
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
      if (close === dispose) close = undefined
    }
    close = dispose
    root.render(<PromptLibrary api={api} initialCreate onClose={dispose} onInsert={prompt => {
      if (!active || ctx.sessions.scope(sessionId) !== scope) throw new Error('会话已关闭，请重新打开模板管理。')
      const state = input.state.getSnapshot()
      const end = state.draft.length
      if (!scope.bail(scope, 'slash/input-insert-text', { text: `${end && !state.draft.endsWith('\n') ? '\n' : ''}${prompt.content}`, span: { start: end, end, draftRev: state.draftRev } })) throw new Error('输入框暂不可编辑，请稍后重试。')
    }} />)
  }
  const sorted = (rows: SavedPrompt[]) => [...rows].sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) || b.createdAt - a.createdAt)
  const source: InputTriggerSource = {
    trigger: '/', name: 'Prompt 模板', order: -20,
    async candidates(_session, request) {
      const query = request.query.toLocaleLowerCase()
      if (query && !'prompt'.startsWith(query) && !query.startsWith('prompt')) return []
      try {
        const rows = sorted(await api.list())
        if (request.signal.aborted) return []
        const filter = query.startsWith('prompt') ? query.slice(6).replace(/^[:：]/, '').trim() : ''
        return [
          ...rows.filter(row => `${row.name}\n${row.content}`.toLocaleLowerCase().includes(filter)).map(row => ({
            name: row.name, description: row.content.replace(/\s+/g, ' ').slice(0, 100), value: JSON.stringify(row),
          })),
          { name: '新建 Prompt 模板', description: '新建 · 复制 · 修改 · 删除', value: 'manage' },
        ]
      } catch {
        return [{ name: '新建 Prompt 模板', description: '加载未完成，打开模板管理重试', value: 'manage' }]
      }
    },
    onPick({ candidate, session, span }) {
      const scope = ctx.sessions.scope(session.sessionId)
      if (!scope) return 'handled'
      if (candidate.value === 'manage') {
        if (scope.bail(scope, 'slash/input-consume-token', { guard: { kind: 'span', span } })) open(session)
        return 'handled'
      }
      if (!candidate.value) return 'handled'
      const row = JSON.parse(candidate.value) as SavedPrompt
      if (scope.bail(scope, 'slash/input-insert-text', { text: row.content, span })) {
        void api.use(row.id).catch(() => ctx.conversation.input.for(scope).notify('info', '提示词已插入，最近使用记录暂未更新。'))
      }
      return 'handled'
    },
    async matchEnter(session, line) {
      if (line !== '/prompt') return undefined
      // Bare Enter while the candidate fetch is pending must never submit /prompt to the model.
      const scope = ctx.sessions.scope(session.sessionId)
      if (scope) ctx.conversation.input.for(scope).notify('info', '请在上方选择 Prompt 模板，或选择新建。')
      return 'handled'
    },
  }
  ctx.effect(() => ctx.inputTriggers.registerSource(source), 'dsh-plugin-prompt: /prompt command')
  ctx.effect(() => () => { close?.() }, 'dsh-plugin-prompt: dialog lifecycle')
}
