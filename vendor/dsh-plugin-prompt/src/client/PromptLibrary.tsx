import { useEffect, useRef, useState } from 'react'
import type { SavedPrompt } from '../prompt-contract.ts'
import { promptStyles } from './prompt-styles.ts'
import type { PromptApi } from './prompt-api.ts'
export { createPromptApi, type PromptApi } from './prompt-api.ts'

export function PromptLibrary({ api, onClose, initialCreate = false }: { initialCreate?: boolean; api: PromptApi; onInsert(prompt: SavedPrompt): void; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const alive = useRef(true)
  const inFlight = useRef(false)
  const [rows, setRows] = useState<SavedPrompt[]>([])
  const [selected, setSelected] = useState<SavedPrompt | null>(null)
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState<(() => void) | null>(null)
  const [deleting, setDeleting] = useState(false)
  const dirty = name !== (selected?.name ?? '') || content !== (selected?.content ?? '')
  const choose = (row: SavedPrompt | null) => { setSelected(row); setName(row?.name ?? ''); setContent(row?.content ?? ''); setError(''); setNotice('') }
  const guard = (action: () => void) => { if (inFlight.current) return; if (dirty) setPending(() => action); else action() }
  const load = async () => {
    setLoading(true); setError('')
    try { const next = await api.list(); if (!alive.current) return; setRows(next); setLoaded(true); if (!initialCreate) choose(next[0] ?? null) }
    catch (cause) { if (alive.current) setError(message(cause)) }
    finally { if (alive.current) setLoading(false) }
  }
  useEffect(() => {
    alive.current = true; dialog.current!.showModal(); nameInput.current?.focus(); void load()
    return () => { alive.current = false; dialog.current?.close() }
  }, [api])
  const save = async () => {
    if (inFlight.current || !loaded) return
    if (!name.trim() || !content.trim()) { setError(!name.trim() ? '请输入模板名称' : '请输入模板正文'); (!name.trim() ? nameInput.current : dialog.current?.querySelector('textarea'))?.focus(); return }
    inFlight.current = true; setBusy(true); setError('')
    try {
      const next = selected ? await api.update(selected.id, name, content) : await api.create(name, content)
      if (!alive.current) return
      setRows(next); choose(next.find(row => selected ? row.id === selected.id : row.name === name.trim()) ?? null); setQuery(''); setNotice('已保存')
    } catch (cause) { if (alive.current) setError(`${message(cause)} 填写内容已保留。`) }
    finally { inFlight.current = false; if (alive.current) setBusy(false) }
  }
  const duplicate = async () => {
    if (inFlight.current || !selected) return
    inFlight.current = true; setBusy(true); setError('')
    try {
      const next = await api.duplicate(name, content)
      if (!alive.current) return
      setRows(next); choose(next.at(-1) ?? null); setQuery(''); setNotice('已创建副本')
    } catch (cause) { if (alive.current) setError(message(cause)) }
    finally { inFlight.current = false; if (alive.current) setBusy(false) }
  }
  const remove = async () => {
    if (!selected || inFlight.current) return
    inFlight.current = true; setBusy(true); setError('')
    try { const next = await api.delete(selected.id); if (!alive.current) return; setRows(next); choose(next[0] ?? null); setNotice('已删除') }
    catch (cause) { if (alive.current) setError(message(cause)) }
    finally { inFlight.current = false; if (alive.current) { setBusy(false); setDeleting(false) } }
  }
  const filtered = rows.filter(row => `${row.name}\n${row.content}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const confirming = !!pending || deleting
  return <><style>{promptStyles}</style><dialog ref={dialog} className="dp-dialog" aria-labelledby="dp-title" onCancel={event => {
    event.preventDefault(); if (busy) return; if (confirming) { setPending(null); setDeleting(false); nameInput.current?.focus() } else guard(onClose)
  }} onKeyDown={event => { if (!event.nativeEvent.isComposing && !confirming && (event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); void save() } }}>
    <div ref={element => { if (element) element.inert = confirming }}>
      <header className="dp-header"><h2 id="dp-title">Prompt 模板</h2><button className="dp-icon" aria-label="关闭模板管理" disabled={busy} onClick={() => guard(onClose)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button></header>
      <div className="dp-workspace">
        <aside className="dp-sidebar"><button className="dp-new" disabled={busy || !loaded} onClick={() => guard(() => { choose(null); nameInput.current?.focus() })}>＋ 新建模板</button>
          {rows.length > 5 && <input className="dp-search" aria-label="搜索模板" placeholder="搜索模板" value={query} onChange={event => setQuery(event.target.value)} />}
          <nav className="dp-list" aria-label="提示词列表">{loading ? <p className="dp-empty" role="status">加载中…</p> : filtered.length ? filtered.map(row => <button key={row.id} className="dp-row" aria-current={selected?.id === row.id ? 'true' : undefined} disabled={busy} onClick={() => { if (selected?.id !== row.id) guard(() => choose(row)) }}><span>{row.name}</span></button>) : <p className="dp-empty">{query ? '没有匹配模板' : '暂无模板'}</p>}</nav>
        </aside>
        <form className="dp-form" onSubmit={event => { event.preventDefault(); void save() }}>
          <div className="dp-fields"><label htmlFor="dp-name">名称</label><input id="dp-name" ref={nameInput} value={name} maxLength={100} disabled={busy || !loaded} placeholder="为模板起个名字" onChange={event => { setName(event.target.value); setNotice('') }} />
          <label htmlFor="dp-content">正文</label><textarea id="dp-content" value={content} maxLength={100000} disabled={busy || !loaded} placeholder="输入常用的提示词…" onChange={event => { setContent(event.target.value); setNotice('') }} />
          {error && <div className="dp-error" role="alert">{error}{!loaded && <button type="button" className="dp-text" disabled={loading} onClick={() => void load()}>重新加载</button>}</div>}
          </div><footer className="dp-footer"><div className="dp-actions"><button type="button" className="dp-text" disabled={busy || !selected || !name.trim() || !content.trim()} onClick={() => void duplicate()}>复制</button><button type="button" className="dp-text dp-delete" disabled={busy || !selected} onClick={() => setDeleting(true)}>删除</button></div><span className="dp-status" role="status">{notice || (dirty ? '未保存' : '')}</span><button className="dp-primary" type="submit" disabled={busy || !loaded || !dirty}>{busy ? '处理中…' : '保存'}</button></footer>
        </form>
      </div>
    </div>
    {confirming && <div className="dp-confirm" role="alertdialog" aria-modal="true" aria-labelledby="dp-confirm-title" onKeyDown={event => { if (event.key === 'Tab') { event.preventDefault(); const buttons = event.currentTarget.querySelectorAll('button'); (document.activeElement === buttons[0] ? buttons[1] : buttons[0])?.focus() } }}><div><h3 id="dp-confirm-title">{deleting ? `删除「${selected?.name}」？` : '放弃未保存的修改？'}</h3><p>{deleting ? '此操作无法撤销。' : '当前修改尚未保存。'}</p><div><button autoFocus className="dp-button" disabled={busy} onClick={() => { setPending(null); setDeleting(false); nameInput.current?.focus() }}>{deleting ? '取消' : '继续编辑'}</button><button className="dp-primary" disabled={busy} onClick={() => { if (deleting) void remove(); else { pending?.(); setPending(null) } }}>{deleting ? '确认删除' : '放弃修改'}</button></div></div></div>}
  </dialog></>
}
function message(cause: unknown): string { return cause instanceof Error ? cause.message : '操作未完成，请稍后重试。' }
