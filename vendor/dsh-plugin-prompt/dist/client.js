window.__ModuleLoader__.load({id:'dsh-plugin-prompt',factory:require=>{const module={exports:{}};const exports=module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/prompt.tsx
var prompt_exports = {};
__export(prompt_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(prompt_exports);
var import_client = require("react-dom/client");

// src/client/PromptLibrary.tsx
var import_react = require("react");

// src/client/prompt-styles.ts
var promptStyles = `
.dp-dialog{--dp-bg:var(--dsw-alias-bg-layer-1,#fff);--dp-soft:var(--dsw-alias-bg-layer-2,#f7f7f8);--dp-fg:var(--dsw-alias-label-primary,#24262b);--dp-muted:var(--dsw-alias-label-secondary,#6b6f78);--dp-line:var(--dsw-alias-border-primary,#e6e7eb);--dp-accent:var(--dsw-alias-brand-primary,#4168cc);padding:0;margin:auto;width:min(760px,calc(100vw - 40px));max-height:calc(100dvh - 40px);overflow:auto;border:1px solid var(--dp-line);border-radius:12px;background:var(--dp-bg);color:var(--dp-fg);box-shadow:0 20px 70px #0002;font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color-scheme:inherit}
.dp-dialog::backdrop{background:#11182738}.dp-dialog *{box-sizing:border-box}.dp-dialog h2,.dp-dialog h3,.dp-dialog p{margin:0}.dp-dialog button,.dp-dialog input,.dp-dialog textarea{font:inherit;color:inherit}.dp-dialog button{cursor:pointer}.dp-dialog button:disabled{opacity:.4;cursor:default}.dp-dialog :is(button,input,textarea):focus-visible{outline:2px solid var(--dp-accent);outline-offset:2px}.dp-header{height:62px;padding:0 20px 0 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--dp-line)}.dp-header h2{font-size:16px;font-weight:600}.dp-icon{display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:6px;background:transparent}.dp-icon:hover{background:var(--dp-soft)}
.dp-workspace{display:grid;grid-template-columns:200px minmax(0,1fr);height:440px;max-height:calc(100dvh - 104px)}.dp-sidebar{padding:14px 10px;display:flex;flex-direction:column;gap:10px;background:var(--dp-soft);border-right:1px solid var(--dp-line);min-height:0}.dp-new{background:transparent;border:1px solid var(--dp-line);border-radius:6px;min-height:36px;text-align:left;padding:6px 12px;font-size:13px!important}.dp-new:hover{background:var(--dp-bg)}.dp-list{overflow:auto;min-height:0;flex:1}.dp-row{display:block;width:100%;border:0;border-radius:6px;padding:10px 12px;text-align:left;background:transparent;font-size:13px!important;margin-bottom:3px}.dp-row span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dp-row:hover{background:var(--dp-bg)}.dp-row[aria-current=true]{background:var(--dp-bg);font-weight:600;box-shadow:0 1px 3px #0000000a}.dp-search{width:100%;padding:6px 10px;border:1px solid var(--dp-line);border-radius:6px;background:var(--dp-bg);font-size:13px!important}.dp-dialog .dp-empty{padding:16px 12px;color:var(--dp-muted);font-size:12px}
.dp-form{min-width:0;min-height:0;display:flex;flex-direction:column}.dp-fields{display:flex;flex-direction:column;gap:8px;flex:1;min-height:0;overflow:auto;padding:22px 24px 16px}.dp-fields label{font-size:12px;color:var(--dp-muted)}.dp-fields input,.dp-fields textarea{width:100%;border:1px solid var(--dp-line);border-radius:6px;background:var(--dp-bg);padding:9px 11px;line-height:1.7}.dp-fields label[for=dp-content]{margin-top:8px}.dp-fields textarea{flex:1;min-height:100px;resize:none}.dp-fields :is(input,textarea)::placeholder{color:var(--dp-muted);opacity:.8}.dp-footer{display:flex;align-items:center;gap:12px;padding:12px 24px 18px}.dp-actions{display:flex;gap:12px}.dp-text{border:0;background:transparent;padding:7px 0;font-size:13px!important;color:var(--dp-muted)!important}.dp-text:hover:not(:disabled){color:var(--dp-fg)!important}.dp-delete:hover:not(:disabled){color:#c24747!important}.dp-status{flex:1;text-align:right;color:var(--dp-muted);font-size:12px}.dp-primary,.dp-button{border:1px solid var(--dp-line);border-radius:6px;padding:7px 16px;min-height:36px;background:var(--dp-bg);white-space:nowrap;font-size:13px!important}.dp-dialog .dp-primary{background:var(--dp-accent);color:white;border-color:transparent}.dp-primary:hover:not(:disabled){filter:brightness(.95)}.dp-error{font-size:12px;color:#c24747;overflow-wrap:anywhere}.dp-error button{margin-left:10px}
.dp-confirm{position:absolute;inset:0;display:grid;place-items:center;background:color-mix(in srgb,var(--dp-bg) 94%,transparent);padding:24px}.dp-confirm>div{width:min(340px,100%)}.dp-confirm h3{font-size:16px;font-weight:600;overflow-wrap:anywhere}.dp-confirm p{margin:10px 0 24px;color:var(--dp-muted);font-size:13px}.dp-confirm>div>div{display:flex;justify-content:flex-end;gap:10px}
@media(prefers-color-scheme:dark){.dp-dialog{--dp-bg:var(--dsw-alias-bg-layer-1,#23252a);--dp-soft:var(--dsw-alias-bg-layer-2,#292c31);--dp-fg:var(--dsw-alias-label-primary,#eef0f3);--dp-muted:var(--dsw-alias-label-secondary,#b0b5bf);--dp-line:var(--dsw-alias-border-primary,#414650)}}
@media(max-width:560px){.dp-dialog{width:calc(100vw - 24px);max-height:calc(100dvh - 24px)}.dp-workspace{grid-template-columns:1fr;height:620px;max-height:calc(100dvh - 88px);grid-template-rows:130px minmax(0,1fr)}.dp-sidebar{padding:10px 16px;border-right:0;border-bottom:1px solid var(--dp-line);gap:6px}.dp-new{min-height:32px}.dp-list{display:flex;gap:6px}.dp-row{width:auto;max-width:200px;flex-shrink:0}.dp-fields{padding:16px}.dp-footer{padding:10px 16px 16px}.dp-search{display:none}}
`;

// src/prompt-contract.ts
var PROMPT_PATH = "/api/dsh-prompts";
function validatePrompt(name2, content) {
  if (typeof name2 !== "string" || !name2.trim() || name2.trim().length > 100) {
    throw new Error("\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A\uFF0C\u4E14\u4E0D\u80FD\u8D85\u8FC7 100 \u4E2A\u5B57\u7B26\u3002");
  }
  if (typeof content !== "string" || !content.trim() || content.length > 1e5) {
    throw new Error("\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A\uFF0C\u4E14\u4E0D\u80FD\u8D85\u8FC7 100,000 \u4E2A\u5B57\u7B26\u3002");
  }
  return { name: name2.trim(), content };
}

// src/client/prompt-api.ts
function createPromptApi() {
  const request = async (body) => {
    let response;
    try {
      response = await fetch(PROMPT_PATH, {
        method: body ? "POST" : "GET",
        credentials: "same-origin",
        redirect: "error",
        cache: "no-store",
        headers: { Accept: "application/json", ...body ? { "content-type": "application/json" } : {} },
        ...body ? { body: JSON.stringify(body) } : {},
        signal: AbortSignal.timeout(15e3)
      });
    } catch {
      throw new Error("\u6682\u65F6\u65E0\u6CD5\u8FDE\u63A5\u63D0\u793A\u8BCD\u670D\u52A1\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002");
    }
    if (response.status === 401 || response.status === 403) throw new Error("\u5F53\u524D\u8FDE\u63A5\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00 Desktop \u540E\u91CD\u8BD5\u3002");
    if (response.status === 404) throw new Error("\u63D0\u793A\u8BCD\u670D\u52A1\u5C1A\u672A\u5C31\u7EEA\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u5E94\u7528\u3002");
    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error("\u63D0\u793A\u8BCD\u670D\u52A1\u8FD4\u56DE\u5F02\u5E38\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00 Desktop \u540E\u91CD\u8BD5\u3002");
    }
    if (!result || typeof result !== "object") throw new Error("\u63D0\u793A\u8BCD\u6570\u636E\u8BFB\u53D6\u5F02\u5E38\uFF0C\u8BF7\u91CD\u8BD5\u3002");
    if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "\u64CD\u4F5C\u672A\u5B8C\u6210\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002");
    if (!Array.isArray(result.prompts)) throw new Error("\u63D0\u793A\u8BCD\u6570\u636E\u8BFB\u53D6\u5F02\u5E38\uFF0C\u8BF7\u91CD\u8BD5\u3002");
    for (const row of result.prompts) {
      if (!row || typeof row.id !== "string" || !Number.isFinite(row.createdAt) || row.lastUsedAt !== null && !Number.isFinite(row.lastUsedAt)) throw new Error("\u63D0\u793A\u8BCD\u6570\u636E\u8BFB\u53D6\u5F02\u5E38\uFF0C\u8BF7\u91CD\u8BD5\u3002");
      validatePrompt(row.name, row.content);
    }
    return result.prompts;
  };
  return { duplicate: (name2, content) => request({ action: "duplicate", name: name2, content }), list: () => request(), create: (name2, content) => request({ action: "create", name: name2, content }), update: (id, name2, content) => request({ action: "update", id, name: name2, content }), delete: (id) => request({ action: "delete", id }), use: (id) => request({ action: "use", id }) };
}

// src/client/PromptLibrary.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function PromptLibrary({ api, onClose, initialCreate = false }) {
  const dialog = (0, import_react.useRef)(null);
  const nameInput = (0, import_react.useRef)(null);
  const alive = (0, import_react.useRef)(true);
  const inFlight = (0, import_react.useRef)(false);
  const [rows, setRows] = (0, import_react.useState)([]);
  const [selected, setSelected] = (0, import_react.useState)(null);
  const [name2, setName] = (0, import_react.useState)("");
  const [content, setContent] = (0, import_react.useState)("");
  const [query, setQuery] = (0, import_react.useState)("");
  const [loading, setLoading] = (0, import_react.useState)(true);
  const [loaded, setLoaded] = (0, import_react.useState)(false);
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)("");
  const [notice, setNotice] = (0, import_react.useState)("");
  const [pending, setPending] = (0, import_react.useState)(null);
  const [deleting, setDeleting] = (0, import_react.useState)(false);
  const dirty = name2 !== (selected?.name ?? "") || content !== (selected?.content ?? "");
  const choose = (row) => {
    setSelected(row);
    setName(row?.name ?? "");
    setContent(row?.content ?? "");
    setError("");
    setNotice("");
  };
  const guard = (action) => {
    if (inFlight.current) return;
    if (dirty) setPending(() => action);
    else action();
  };
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const next = await api.list();
      if (!alive.current) return;
      setRows(next);
      setLoaded(true);
      if (!initialCreate) choose(next[0] ?? null);
    } catch (cause) {
      if (alive.current) setError(message(cause));
    } finally {
      if (alive.current) setLoading(false);
    }
  };
  (0, import_react.useEffect)(() => {
    alive.current = true;
    dialog.current.showModal();
    nameInput.current?.focus();
    void load();
    return () => {
      alive.current = false;
      dialog.current?.close();
    };
  }, [api]);
  const save = async () => {
    if (inFlight.current || !loaded) return;
    if (!name2.trim() || !content.trim()) {
      setError(!name2.trim() ? "\u8BF7\u8F93\u5165\u6A21\u677F\u540D\u79F0" : "\u8BF7\u8F93\u5165\u6A21\u677F\u6B63\u6587");
      (!name2.trim() ? nameInput.current : dialog.current?.querySelector("textarea"))?.focus();
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const next = selected ? await api.update(selected.id, name2, content) : await api.create(name2, content);
      if (!alive.current) return;
      setRows(next);
      choose(next.find((row) => selected ? row.id === selected.id : row.name === name2.trim()) ?? null);
      setQuery("");
      setNotice("\u5DF2\u4FDD\u5B58");
    } catch (cause) {
      if (alive.current) setError(`${message(cause)} \u586B\u5199\u5185\u5BB9\u5DF2\u4FDD\u7559\u3002`);
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const duplicate = async () => {
    if (inFlight.current || !selected) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const next = await api.duplicate(name2, content);
      if (!alive.current) return;
      setRows(next);
      choose(next.at(-1) ?? null);
      setQuery("");
      setNotice("\u5DF2\u521B\u5EFA\u526F\u672C");
    } catch (cause) {
      if (alive.current) setError(message(cause));
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const remove = async () => {
    if (!selected || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const next = await api.delete(selected.id);
      if (!alive.current) return;
      setRows(next);
      choose(next[0] ?? null);
      setNotice("\u5DF2\u5220\u9664");
    } catch (cause) {
      if (alive.current) setError(message(cause));
    } finally {
      inFlight.current = false;
      if (alive.current) {
        setBusy(false);
        setDeleting(false);
      }
    }
  };
  const filtered = rows.filter((row) => `${row.name}
${row.content}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const confirming = !!pending || deleting;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: promptStyles }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dialog", { ref: dialog, className: "dp-dialog", "aria-labelledby": "dp-title", onCancel: (event) => {
      event.preventDefault();
      if (busy) return;
      if (confirming) {
        setPending(null);
        setDeleting(false);
        nameInput.current?.focus();
      } else guard(onClose);
    }, onKeyDown: (event) => {
      if (!event.nativeEvent.isComposing && !confirming && (event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void save();
      }
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { ref: (element) => {
        if (element) element.inert = confirming;
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "dp-header", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { id: "dp-title", children: "Prompt \u6A21\u677F" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dp-icon", "aria-label": "\u5173\u95ED\u6A21\u677F\u7BA1\u7406", disabled: busy, onClick: () => guard(onClose), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.6", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m6 6 12 12M6 18 18 6" }) }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dp-workspace", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", { className: "dp-sidebar", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dp-new", disabled: busy || !loaded, onClick: () => guard(() => {
              choose(null);
              nameInput.current?.focus();
            }), children: "\uFF0B \u65B0\u5EFA\u6A21\u677F" }),
            rows.length > 5 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: "dp-search", "aria-label": "\u641C\u7D22\u6A21\u677F", placeholder: "\u641C\u7D22\u6A21\u677F", value: query, onChange: (event) => setQuery(event.target.value) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", { className: "dp-list", "aria-label": "\u63D0\u793A\u8BCD\u5217\u8868", children: loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dp-empty", role: "status", children: "\u52A0\u8F7D\u4E2D\u2026" }) : filtered.length ? filtered.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dp-row", "aria-current": selected?.id === row.id ? "true" : void 0, disabled: busy, onClick: () => {
              if (selected?.id !== row.id) guard(() => choose(row));
            }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: row.name }) }, row.id)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dp-empty", children: query ? "\u6CA1\u6709\u5339\u914D\u6A21\u677F" : "\u6682\u65E0\u6A21\u677F" }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", { className: "dp-form", onSubmit: (event) => {
            event.preventDefault();
            void save();
          }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dp-fields", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: "dp-name", children: "\u540D\u79F0" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { id: "dp-name", ref: nameInput, value: name2, maxLength: 100, disabled: busy || !loaded, placeholder: "\u4E3A\u6A21\u677F\u8D77\u4E2A\u540D\u5B57", onChange: (event) => {
                setName(event.target.value);
                setNotice("");
              } }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: "dp-content", children: "\u6B63\u6587" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { id: "dp-content", value: content, maxLength: 1e5, disabled: busy || !loaded, placeholder: "\u8F93\u5165\u5E38\u7528\u7684\u63D0\u793A\u8BCD\u2026", onChange: (event) => {
                setContent(event.target.value);
                setNotice("");
              } }),
              error && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dp-error", role: "alert", children: [
                error,
                !loaded && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dp-text", disabled: loading, onClick: () => void load(), children: "\u91CD\u65B0\u52A0\u8F7D" })
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", { className: "dp-footer", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dp-actions", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dp-text", disabled: busy || !selected || !name2.trim() || !content.trim(), onClick: () => void duplicate(), children: "\u590D\u5236" }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dp-text dp-delete", disabled: busy || !selected, onClick: () => setDeleting(true), children: "\u5220\u9664" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dp-status", role: "status", children: notice || (dirty ? "\u672A\u4FDD\u5B58" : "") }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dp-primary", type: "submit", disabled: busy || !loaded || !dirty, children: busy ? "\u5904\u7406\u4E2D\u2026" : "\u4FDD\u5B58" })
            ] })
          ] })
        ] })
      ] }),
      confirming && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dp-confirm", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "dp-confirm-title", onKeyDown: (event) => {
        if (event.key === "Tab") {
          event.preventDefault();
          const buttons = event.currentTarget.querySelectorAll("button");
          (document.activeElement === buttons[0] ? buttons[1] : buttons[0])?.focus();
        }
      }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { id: "dp-confirm-title", children: deleting ? `\u5220\u9664\u300C${selected?.name}\u300D\uFF1F` : "\u653E\u5F03\u672A\u4FDD\u5B58\u7684\u4FEE\u6539\uFF1F" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: deleting ? "\u6B64\u64CD\u4F5C\u65E0\u6CD5\u64A4\u9500\u3002" : "\u5F53\u524D\u4FEE\u6539\u5C1A\u672A\u4FDD\u5B58\u3002" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { autoFocus: true, className: "dp-button", disabled: busy, onClick: () => {
            setPending(null);
            setDeleting(false);
            nameInput.current?.focus();
          }, children: deleting ? "\u53D6\u6D88" : "\u7EE7\u7EED\u7F16\u8F91" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dp-primary", disabled: busy, onClick: () => {
            if (deleting) void remove();
            else {
              pending?.();
              setPending(null);
            }
          }, children: deleting ? "\u786E\u8BA4\u5220\u9664" : "\u653E\u5F03\u4FEE\u6539" })
        ] })
      ] }) })
    ] })
  ] });
}
function message(cause) {
  return cause instanceof Error ? cause.message : "\u64CD\u4F5C\u672A\u5B8C\u6210\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002";
}

// src/client/prompt.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var name = "dsh-plugin-prompt";
var inject = ["inputTriggers", "conversation", "sessions"];
function apply(ctx) {
  let close;
  const api = createPromptApi();
  const open = ({ sessionId }) => {
    close?.();
    const scope = ctx.sessions.scope(sessionId);
    if (!scope) return;
    const input = ctx.conversation.input.for(scope);
    const container = document.createElement("div");
    document.body.append(container);
    const root = (0, import_client.createRoot)(container);
    const previousFocus = document.activeElement;
    let active = true;
    const dispose = () => {
      if (!active) return;
      active = false;
      root.unmount();
      container.remove();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
      if (close === dispose) close = void 0;
    };
    close = dispose;
    root.render(/* @__PURE__ */ (0, import_jsx_runtime2.jsx)(PromptLibrary, { api, initialCreate: true, onClose: dispose, onInsert: (prompt) => {
      if (!active || ctx.sessions.scope(sessionId) !== scope) throw new Error("\u4F1A\u8BDD\u5DF2\u5173\u95ED\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u6A21\u677F\u7BA1\u7406\u3002");
      const state = input.state.getSnapshot();
      const end = state.draft.length;
      if (!scope.bail(scope, "slash/input-insert-text", { text: `${end && !state.draft.endsWith("\n") ? "\n" : ""}${prompt.content}`, span: { start: end, end, draftRev: state.draftRev } })) throw new Error("\u8F93\u5165\u6846\u6682\u4E0D\u53EF\u7F16\u8F91\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002");
    } }));
  };
  const sorted = (rows) => [...rows].sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) || b.createdAt - a.createdAt);
  const source = {
    trigger: "/",
    name: "Prompt \u6A21\u677F",
    order: -20,
    async candidates(_session, request) {
      const query = request.query.toLocaleLowerCase();
      if (query && !"prompt".startsWith(query) && !query.startsWith("prompt")) return [];
      try {
        const rows = sorted(await api.list());
        if (request.signal.aborted) return [];
        const filter = query.startsWith("prompt") ? query.slice(6).replace(/^[:：]/, "").trim() : "";
        return [
          ...rows.filter((row) => `${row.name}
${row.content}`.toLocaleLowerCase().includes(filter)).map((row) => ({
            name: row.name,
            description: row.content.replace(/\s+/g, " ").slice(0, 100),
            value: JSON.stringify(row)
          })),
          { name: "\u65B0\u5EFA Prompt \u6A21\u677F", description: "\u65B0\u5EFA \xB7 \u590D\u5236 \xB7 \u4FEE\u6539 \xB7 \u5220\u9664", value: "manage" }
        ];
      } catch {
        return [{ name: "\u65B0\u5EFA Prompt \u6A21\u677F", description: "\u52A0\u8F7D\u672A\u5B8C\u6210\uFF0C\u6253\u5F00\u6A21\u677F\u7BA1\u7406\u91CD\u8BD5", value: "manage" }];
      }
    },
    onPick({ candidate, session, span }) {
      const scope = ctx.sessions.scope(session.sessionId);
      if (!scope) return "handled";
      if (candidate.value === "manage") {
        if (scope.bail(scope, "slash/input-consume-token", { guard: { kind: "span", span } })) open(session);
        return "handled";
      }
      if (!candidate.value) return "handled";
      const row = JSON.parse(candidate.value);
      if (scope.bail(scope, "slash/input-insert-text", { text: row.content, span })) {
        void api.use(row.id).catch(() => ctx.conversation.input.for(scope).notify("info", "\u63D0\u793A\u8BCD\u5DF2\u63D2\u5165\uFF0C\u6700\u8FD1\u4F7F\u7528\u8BB0\u5F55\u6682\u672A\u66F4\u65B0\u3002"));
      }
      return "handled";
    },
    async matchEnter(session, line) {
      if (line !== "/prompt") return void 0;
      const scope = ctx.sessions.scope(session.sessionId);
      if (scope) ctx.conversation.input.for(scope).notify("info", "\u8BF7\u5728\u4E0A\u65B9\u9009\u62E9 Prompt \u6A21\u677F\uFF0C\u6216\u9009\u62E9\u65B0\u5EFA\u3002");
      return "handled";
    }
  };
  ctx.effect(() => ctx.inputTriggers.registerSource(source), "dsh-plugin-prompt: /prompt command");
  ctx.effect(() => () => {
    close?.();
  }, "dsh-plugin-prompt: dialog lifecycle");
}

return module.exports;}});
