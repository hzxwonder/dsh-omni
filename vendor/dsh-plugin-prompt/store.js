import { randomUUID } from 'node:crypto'
import { readFile, mkdir, writeFile, rename, unlink } from 'node:fs/promises'
import { dirname } from 'node:path'

function validate(name, content) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100)
    throw new Error('名称不能为空，且不能超过 100 个字符。')
  if (typeof content !== 'string' || !content.trim() || content.length > 100_000)
    throw new Error('内容不能为空，且不能超过 100,000 个字符。')
  return { name: name.trim(), content }
}

export class PromptStore {
  #tail = Promise.resolve()
  constructor(path) { this.path = path }

  async list() {
    let text
    try { text = await readFile(this.path, 'utf8') }
    catch (error) {
      if (error.code === 'ENOENT') return []
      throw error
    }
    const rows = JSON.parse(text)
    if (!Array.isArray(rows)) throw new Error('提示词数据格式无效。')
    const ids = new Set()
    for (const row of rows) {
      if (!row || typeof row.id !== 'string' || ids.has(row.id)
        || !Number.isFinite(row.createdAt)
        || (row.lastUsedAt !== null && !Number.isFinite(row.lastUsedAt)))
        throw new Error('提示词数据格式无效。')
      validate(row.name, row.content)
      ids.add(row.id)
    }
    return rows
  }

  change(operation) {
    const task = this.#tail.then(() => this.#change(operation))
    this.#tail = task.catch(() => {})
    return task
  }

  async #change(operation) {
    if (!operation || typeof operation !== 'object' || Array.isArray(operation))
      throw new Error('无效操作。')
    const rows = await this.list()
    if (operation.action === 'create' || operation.action === 'duplicate') {
      const value = validate(operation.name, operation.content)
      if (operation.action === 'duplicate') {
        const names = new Set(rows.map(row => row.name.toLocaleLowerCase()))
        const base = value.name
        let number = 1
        do {
          const suffix = number === 1 ? ' - copy' : ` - copy ${number}`
          value.name = base.slice(0, 100 - suffix.length).trimEnd() + suffix
          number++
        } while (names.has(value.name.toLocaleLowerCase()))
      }
      if (rows.some(row => row.name.toLocaleLowerCase() === value.name.toLocaleLowerCase()))
        throw new Error('此名称已存在，请使用其他名称。')
      if (rows.length >= 1000) throw new Error('最多保存 1,000 条提示词。')
      rows.push({ ...value, id: randomUUID(), createdAt: Date.now(), lastUsedAt: null })
    } else if (operation.action === 'update') {
      const row = rows.find(row => row.id === operation.id)
      if (!row) throw new Error('提示词不存在，请重新加载。')
      const value = validate(operation.name, operation.content)
      if (rows.some(other => other.id !== row.id && other.name.toLocaleLowerCase() === value.name.toLocaleLowerCase()))
        throw new Error('此名称已存在，请使用其他名称。')
      Object.assign(row, value)
    } else if (operation.action === 'delete') {
      const index = rows.findIndex(row => row.id === operation.id)
      if (index === -1) throw new Error('提示词不存在，请重新加载。')
      rows.splice(index, 1)
    } else if (operation.action === 'use') {
      const row = rows.find(row => row.id === operation.id)
      if (!row) throw new Error('提示词不存在，请重新打开窗口。')
      row.lastUsedAt = Date.now()
    } else throw new Error('无效操作。')
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 })
    const temp = `${this.path}.${randomUUID()}.tmp`
    try {
      await writeFile(temp, JSON.stringify(rows, null, 2), { mode: 0o600 })
      await rename(temp, this.path)
    } finally {
      await unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error })
    }
    return rows
  }
}
