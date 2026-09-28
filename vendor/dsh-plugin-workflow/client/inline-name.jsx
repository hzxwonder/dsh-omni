import React, { useState } from 'react';

// 双击就地重命名（Electron 渲染进程没有 window.prompt）。
// 用于流程图卡片、外壳标题、步骤列表与检查器标题，提交后由调用方同步到定义。
export function InlineName({ value, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing) {
    return <strong title="双击重命名" onDoubleClick={(e) => { e.stopPropagation(); setDraft(value); setEditing(true); }}>{value}</strong>;
  }
  return (
    <input className="wf-title-input" value={draft} autoFocus size={Math.max(6, draft.length + 2)}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") { setEditing(false); const v = draft.trim(); if (v && v !== value) onRename?.(v); }
        if (e.key === "Escape") setEditing(false);
      }}
      onBlur={() => { setEditing(false); const v = draft.trim(); if (v && v !== value) onRename?.(v); }}
      onChange={(e) => setDraft(e.target.value)} />
  );
}
