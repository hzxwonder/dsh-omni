import React, { useEffect, useRef, useState } from 'react';

const folders = [
  ['assets', '素材'],
  ['references', '参考资料'],
  ['scripts', '脚本'],
];
const textName = name => /\.(?:md|txt|json|jsonc|yaml|yml|js|jsx|ts|tsx|py|sh|css|html|csv|xml|svg)$/i.test(name);
const safeName = name => name && !name.includes('\\') && !name.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.'));

async function encodeFile(file) {
  if (file.size > 8 * 1024 * 1024) throw new Error('单个文件不能超过 8 MB');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}

export async function uploadResource(file, api) {
  const { blob, bytes } = await api({ action: 'resourceUpload', base64: await encodeFile(file) });
  return { blob, bytes, mediaType: file.type || 'application/octet-stream' };
}

function TextOrBlob({ entry, update, replace, api, label }) {
  const [loaded, setLoaded] = useState(null);
  const [readError, setReadError] = useState('');
  const replaceInput = useRef();
  useEffect(() => {
    let active = true;
    setLoaded(null); setReadError('');
    if (entry.content !== undefined || !entry.blob) return;
    api({ action: 'resourceRead', blob: entry.blob })
      .then(result => { if (active) setLoaded(result.content); })
      .catch(error => { if (active) setReadError(error.message); });
    return () => { active = false; };
  }, [entry.blob, entry.content]);
  const editable = entry.content !== undefined || loaded !== null;
  return <div className="wf-resource-content">
    {editable ? <label className="wf-resource-field">{label}
      <textarea spellCheck={false} value={entry.content ?? loaded ?? ''}
        onChange={event => update({ ...entry, content: event.target.value, blob: undefined, bytes: undefined })} />
    </label> : <p className="wf-panel-note">{readError ? '此文件以二进制形式保存，可用替换文件更新。' : '正在读取文件…'}</p>}
    <input ref={replaceInput} type="file" hidden aria-label={`替换 ${label}`} onChange={async event => {
      const file = event.target.files?.[0]; event.target.value = '';
      if (file) await replace(file);
    }} />
    <button type="button" onClick={() => replaceInput.current?.click()}>{entry.blob || entry.content ? '从本地替换' : '选择本地文件'}</button>
  </div>;
}

export function SkillResourceEditor({ node, update, api, onError, savedPath }) {
  const skill = node.skill;
  const [selected, setSelected] = useState('SKILL.md');
  const [creating, setCreating] = useState('');
  const [newName, setNewName] = useState('');
  const [deletePath, setDeletePath] = useState('');
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef(null);
  useEffect(() => { if (expanded) dialog.current?.showModal(); }, [expanded]);
  const imports = useRef({});
  const entry = skill.files.find(file => file.path === selected);
  const patch = next => update({ skill: { ...skill, ...next } });
  const setEntry = value => patch({ files: skill.files.map(file => file.path === selected ? value : file) });
  const addImported = async (folder, fileList, replacing) => {
    try {
      const added = [];
      for (const file of [...fileList]) {
        const path = replacing || `${folder}/${file.name}`;
        if (!safeName(path) || !path.startsWith(folder + '/')) throw new Error('文件名不符合目录规则');
        if (!replacing && skill.files.some(item => item.path === path)) throw new Error(`${path} 已存在`);
        added.push({ path, ...await uploadResource(file, api) });
      }
      const files = replacing ? skill.files.map(item => item.path === replacing ? added[0] : item) : [...skill.files, ...added];
      patch({ files });
      if (added[0]) setSelected(added[0].path);
    } catch (error) { onError(error.message); }
  };
  const create = () => {
    const path = `${creating}/${newName.trim()}`;
    if (!safeName(path) || !textName(path)) { onError('请输入该目录下的文本文件名，例如 guide.md'); return; }
    if (skill.files.some(file => file.path === path)) { onError('该文件已存在'); return; }
    patch({ files: [...skill.files, { path, content: '' }] });
    setSelected(path); setCreating(''); setNewName('');
  };
  const workspace = <div className="wf-resource-workspace">
    <div className="wf-resource-tree" aria-label="Skill 文件结构">
      <button type="button" className={selected === 'SKILL.md' ? 'is-selected' : ''} onClick={() => setSelected('SKILL.md')}>SKILL.md <span>说明</span></button>
      {folders.map(([folder, title]) => <details key={folder} open>
        <summary>{folder}/ <span>{title} · {skill.files.filter(file => file.path.startsWith(folder + '/')).length} 个文件</span></summary>
        <div className="wf-resource-folder">
          {skill.files.filter(file => file.path.startsWith(folder + '/')).map(file =>
            <button type="button" key={file.path} className={selected === file.path ? 'is-selected' : ''} onClick={() => setSelected(file.path)}>{file.path.slice(folder.length + 1)}</button>)}
          <div className="wf-resource-actions">
            <button type="button" onClick={() => { setCreating(folder); setNewName(''); }}>新建文件</button>
            <button type="button" onClick={() => imports.current[folder]?.click()}>导入文件</button>
            <input type="file" multiple hidden ref={element => { imports.current[folder] = element; }} aria-label={`向 ${folder} 导入文件`}
              onChange={event => { void addImported(folder, event.target.files); event.target.value = ''; }} />
          </div>
          {creating === folder && <div className="wf-resource-create"><input autoFocus aria-label={`${folder} 新文件名`} placeholder="例如 guide.md" value={newName}
            onChange={event => setNewName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') create(); if (event.key === 'Escape') setCreating(''); }} />
            <button type="button" onClick={create}>创建</button><button type="button" onClick={() => setCreating('')}>取消</button></div>}
        </div>
      </details>)}
    </div>
    <div className="wf-resource-document">{selected === 'SKILL.md' ? <div className="wf-resource-fields">
      <label className="wf-resource-field">名称 <small>小写英文、数字和连字符</small>
        <input value={skill.name} onChange={event => patch({ name: event.target.value })} placeholder="my-skill" /></label>
      <label className="wf-resource-field">用途说明 <small>说明何时应使用这个 Skill</small>
        <textarea rows={3} value={skill.description} onChange={event => patch({ description: event.target.value })} /></label>
      <label className="wf-resource-field">SKILL.md 正文
        <textarea className="wf-resource-instructions" spellCheck={false} value={skill.instructions} onChange={event => patch({ instructions: event.target.value })} /></label>
      <p className="wf-panel-note">名称和用途说明将写入 SKILL.md 的 YAML 头部。脚本仅作为文件保存，由步骤授权的工具决定是否运行。</p>
    </div> : entry ? <div className="wf-resource-file-editor">
      <div className="wf-resource-file-head"><strong>{entry.path}</strong><button type="button" onClick={() => setDeletePath(entry.path)}>删除文件</button></div>
      {deletePath === entry.path && <div className="wf-resource-delete">删除此文件？<button type="button" onClick={() => { patch({ files: skill.files.filter(file => file.path !== entry.path) }); setSelected('SKILL.md'); setDeletePath(''); }}>确认删除</button><button type="button" onClick={() => setDeletePath('')}>取消</button></div>}
      <TextOrBlob entry={entry} label={entry.path} update={setEntry} api={api} replace={file => addImported(entry.path.split('/')[0], [file], entry.path)} />
    </div> : null}</div>
  </div>;
  return <>
    <div className="wf-resource-editor">
      <div className="wf-resource-summary"><strong>Skill 文件夹</strong><span>保存后生成标准目录</span></div>
      <button type="button" onClick={() => setExpanded(true)}>展开文件编辑器</button>
      {savedPath && <div className="wf-resource-path"><code title={savedPath}>{savedPath}</code><button type="button" onClick={() => navigator.clipboard.writeText(savedPath)}>复制路径</button></div>}
      {!expanded && workspace}
    </div>
    {expanded && <dialog ref={dialog} className="wf-resource-dialog wf" onCancel={event => { event.preventDefault(); setExpanded(false); }}>
      <header><div><strong>{node.name}</strong><span>Skill 文件夹</span></div><button type="button" onClick={() => setExpanded(false)}>完成编辑</button></header>
      {workspace}
    </dialog>}
  </>;
}

export function FileResourceEditor({ node, update, api, onError, savedPath }) {
  const file = node.file;
  const patch = next => update({ file: { ...file, ...next } });
  return <div className="wf-resource-editor">
    <div className="wf-resource-summary"><strong>文件</strong><span>连线后在下游步骤中插入路径</span></div>
    <label className="wf-resource-field">文件名
      <input value={file.name} onChange={event => patch({ name: event.target.value })} placeholder="notes.md" /></label>
    {savedPath && <div className="wf-resource-path"><code title={savedPath}>{savedPath}</code><button type="button" onClick={() => navigator.clipboard.writeText(savedPath)}>复制路径</button></div>}
    <TextOrBlob entry={file} label="文件内容" update={patch} api={api} replace={async selected => {
      try { patch({ name: selected.name, content: undefined, ...await uploadResource(selected, api) }); }
      catch (error) { onError(error.message); }
    }} />
    <p className="wf-panel-note">Prompt 中只插入文件路径。正文保存在工作流的版本目录中，供下游步骤按需读取。</p>
  </div>;
}
