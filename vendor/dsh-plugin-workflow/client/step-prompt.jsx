import React, {useLayoutEffect, useRef, useState} from 'react';
import {canConnect} from '../lib/graph-edit.js';

function serialize(root) {
  const read = node => {
    if (node.dataset?.reference) return node.dataset.auto ? '' : `{{input.${node.dataset.reference}}}`;
    if (node.nodeType === 3) return node.textContent;
    if (node.nodeName === 'BR') return '\n';
    const text = [...node.childNodes].map(read).join('');
    return ['DIV', 'P'].includes(node.nodeName) && node !== root ? text + '\n' : text;
  };
  return read(root).replace(/\n$/, '');
}

const TOKEN = /(\{\{input\.[a-zA-Z0-9_-]+\}\})/g;

// @ 候选里高亮命中的前缀，让「匹配」一眼可见。
const highlightMatch = (name, query) => {
  const q = query.trim();
  const i = q ? name.indexOf(q) : -1;
  if (i < 0) return name;
  return <>{name.slice(0, i)}<b className="wf-match">{name.slice(i, i + q.length)}</b>{name.slice(i + q.length)}</>;
};

export function StepPrompt({node, definition, onChange, onReference}) {
  const editor = useRef(null);
  const last = useRef();
  const savedRange = useRef(null);
  const pickerRef = useRef(null);
  // @ completion session: atIndex is the character position of the live "@"
  // inside the editor text; -1 means no completion is in progress.
  const [atIndex, setAtIndex] = useState(-1);
  const [query, setQuery] = useState('');
  const [pickerPos, setPickerPos] = useState(null);
  const [active, setActive] = useState(0);

  const makeChip = (key, auto = false, name, kind) => {
    const ref = node.input?.[key];
    const source = definition.nodes.find(n => n.id === ref?.nodeId);
    const chip = document.createElement('span');
    chip.contentEditable = 'false';
    chip.dataset.reference = key;
    if (auto) chip.dataset.auto = '1';
    chip.draggable = true;
    chip.className = `wf-inline-reference wf-step-${kind ?? source?.kind ?? 'input'}${auto ? ' wf-reference-auto' : ''}`;
    chip.textContent = name ?? source?.name ?? (ref?.source === 'workflow' ? '用户材料' : key);
    chip.title = auto
      ? '此输入会自动附在消息开头；拖入正文中可指定位置'
      : '引用此步骤的结果；拖动调整位置，按住 Option/Alt 拖动为复制';
    return chip;
  };

  useLayoutEffect(() => {
    const value = node.prompt ?? '';
    if (last.current === value) return;
    const root = editor.current;
    const referenced = new Set();
    const body = [];
    for (const part of value.split(TOKEN)) {
      const key = /^\{\{input\.([a-zA-Z0-9_-]+)\}\}$/.exec(part)?.[1];
      if (!key) { if (part) body.push(document.createTextNode(part)); continue; }
      referenced.add(key);
      body.push(makeChip(key));
    }
    root.replaceChildren(...body);
    last.current = value;
  }, [node.prompt, node.input, definition.nodes]);

  const sync = () => { const text = serialize(editor.current); last.current = text; onChange(text); };

  const chipAt = (key) => makeChip(key, false);
  const insertAtCaret = (el) => {
    const selection = window.getSelection();
    const range = savedRange.current ?? (selection?.rangeCount ? selection.getRangeAt(0) : null);
    if (!range) { editor.current.append(el); } else {
      range.deleteContents();
      range.insertNode(el);
      range.setStartAfter(el); range.collapse(true);
      selection?.removeAllRanges(); selection?.addRange(range);
    }
  };

  const caretOffset = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return -1;
    const end = selection.getRangeAt(0);
    const pre = end.cloneRange();
    pre.selectNodeContents(editor.current);
    pre.setEnd(end.endContainer, end.endOffset);
    return pre.toString().length;
  };
  const rangeOver = (start, end) => {
    const walker = document.createTreeWalker(editor.current, NodeFilter.SHOW_TEXT);
    let pos = 0, n1, n2, o1 = 0, o2 = 0;
    while (walker.nextNode()) {
      const len = walker.currentNode.length;
      if (n1 === undefined && pos + len >= start) { n1 = walker.currentNode; o1 = start - pos; }
      if (n1 !== undefined && pos + len >= end) { n2 = walker.currentNode; o2 = end - pos; break; }
      pos += len;
    }
    if (n1 === undefined) return null;
    const range = document.createRange();
    range.setStart(n1, Math.max(0, o1));
    try { range.setEnd(n2 ?? n1, Math.max(0, o2)); } catch { range.collapse(true); }
    return range;
  };
  const commitAt = (source) => {
    if (!source) { setAtIndex(-1); setQuery(''); return; }
    const key = onReference?.(source.id);
    if (key == null) { setAtIndex(-1); setQuery(''); return; }
    const offset = Math.max(caretOffset(), atIndex + 1);
    const range = rangeOver(Math.max(0, atIndex), offset);
    if (range) { range.deleteContents(); range.insertNode(makeChip(key, false, source.name, source.kind)); }
    sync();
    setAtIndex(-1); setQuery(''); setActive(0);
  };

  // 会话从文本本身推导（GitHub 式）：光标前是 "@前缀" 就显示候选。拼音组合、
  // 中文上屏与退格删除都走同一条推导路径，输入法打字与删错重输都能继续匹配。
  const refreshSession = () => {
    const offset = caretOffset();
    if (offset < 0) { setAtIndex(-1); return; }
    const before = editor.current.textContent.slice(0, offset);
    // 中文提示词没有空格分词，@ 前允许任意字符（可选一个空格缓冲）。
    const m = before.match(/@ ?([^\s@]*)$/);
    if (!m) { setAtIndex(-1); setQuery(''); return; }
    const start = before.length - m[1].length - 1;
    setAtIndex(start);
    setQuery(m[1]);
    const rect = rangeOver(start, start + 1)?.getBoundingClientRect();
    const host = editor.current.getBoundingClientRect();
    if (rect && (rect.width || rect.height || rect.x)) {
      setPickerPos({
        left: Math.max(0, Math.min(rect.left - host.left, host.width - 250)),
        top: rect.bottom - host.top + 6,
      });
    }
  };

  const matched = definition.nodes
    .filter(n => canConnect(definition, n.id, node.id) && n.name.startsWith(query.trim()));
  const popupOpen = atIndex >= 0;
  const activeIndex = Math.min(active, Math.max(0, matched.length - 1));

  const onKeyDown = e => {
    e.stopPropagation();
    if (e.isComposing) return; // 拼音组合期间交给输入法处理
    if (popupOpen) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, matched.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const target = matched[activeIndex];
        if (target) commitAt(target);
        return;
      }
      if (e.key === 'Escape') { setAtIndex(-1); setQuery(''); setActive(0); return; }
    }
  };
  const onInput = () => {
    sync();
    refreshSession();
  };
  const onPaste = e => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (!range) return;
    range.deleteContents();
    for (const part of text.split(TOKEN)) {
      const key = /^\{\{input\.([a-zA-Z0-9_-]+)\}\}$/.exec(part)?.[1];
      if (key && node.input?.[key]) range.insertNode(makeChip(key));
      else if (part) range.insertNode(document.createTextNode(part));
    }
    selection.removeAllRanges();
    const caret = document.createRange(); caret.collapse(false);
    selection.addRange(caret);
    sync();
    setAtIndex(-1);
  };
  const onCopy = e => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return;
    const holder = document.createElement('div');
    holder.append(selection.getRangeAt(0).cloneContents());
    e.clipboardData.setData('text/plain', serialize(holder).replace(/\n$/, ''));
    e.preventDefault();
  };
  const onDragStart = e => {
    const chip = e.target.closest?.('[data-reference]');
    if (!chip) return;
    e.dataTransfer.setData('application/wf-reference', chip.dataset.reference);
    e.dataTransfer.effectAllowed = 'copyMove';
  };
  const onDrop = e => {
    const key = e.dataTransfer.getData('application/wf-reference');
    if (!key || !node.input?.[key]) return;
    e.preventDefault();
    const caret = document.caretRangeFromPoint(e.clientX, e.clientY);
    if (!caret) return;
    const chip = chipAt(key);
    caret.insertNode(chip);
    if (!e.altKey) {
      const original = [...editor.current.querySelectorAll('[data-reference]')]
        .find(el => el.dataset.reference === key && el.dataset.auto !== '1' && el !== chip);
      original?.remove();
    }
    sync();
  };

  return <div className="wf-prompt-composer">
    <div ref={editor} contentEditable suppressContentEditableWarning role="textbox" aria-label="Prompt" aria-multiline="true"
      className="wf-step-prompt" data-placeholder="通过@键来加入不同的输入"
      onInput={onInput} onKeyDown={onKeyDown} onPaste={onPaste} onCopy={onCopy}
      onDragStart={onDragStart} onDragOver={e => { if (e.dataTransfer.types.includes('application/wf-reference')) e.preventDefault(); }}
      onDrop={onDrop} onBlur={() => setAtIndex(-1)}
    />
    {popupOpen && (
      <div className="wf-reference-picker" role="listbox" aria-label="选择要引用的步骤" ref={pickerRef}
        style={{ left: pickerPos?.left ?? 0, top: pickerPos?.top ?? 0 }}
      >
        {matched.map((source, i) => (
          <button type="button" key={source.id} role="option" aria-selected={i === activeIndex}
            className={`wf-step-${source.kind}${i === activeIndex ? ' is-active' : ''}`}
            onMouseDown={e => e.preventDefault()}
            onClick={() => commitAt(source)}
          >
            {highlightMatch(source.name, query)}
          </button>
        ))}
        {!matched.length && <p className="wf-muted">没有匹配的步骤</p>}
      </div>
    )}
  </div>;
}
