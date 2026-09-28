import { readFile } from "node:fs/promises";
import { fail } from "./definition.js";
import { hash, uid } from "./store.js";
import { renderPrompt } from "./graph-edit.js";
import { publishHalo } from './publisher.js';

// Only the authored step prompt enables delegation; input materials cannot grant tools.
export function stepTools(node) {
  const allow = [...(node.tools ?? [])];
  if (Object.values(node.input ?? {}).some(ref => ref?.resourceKind === 'skill' || ref?.resourceKind === 'file') && !allow.includes('read')) allow.push('read');
  if (/使用\s*subagents?\b/i.test(node.prompt ?? '') && !allow.includes('subagent')) allow.push('subagent');
  return allow;
}

const INLINE_LIMIT = 8000;

export function fileBlocks(input) {
  const attachments = typeof input === "object" && input ? input.attachments : [];
  return (attachments ?? []).filter(
    (a) => ["file", "image"].includes(a.type) && a.attachment?.attachmentId,
  );
}

function compactValue(value, files) {
  if (typeof value === "string") {
    if (files.length && value.length > INLINE_LIMIT)
      return `[omitted ${value.length} characters; read the attached files instead]`;
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => compactValue(item, files));
  if (value && typeof value === "object") {
    const next = {};
    for (const [key, nested] of Object.entries(value)) {
      if (key === "attachments") continue;
      next[key] = compactValue(nested, files);
    }
    return next;
  }
  return value;
}

export function compactFields(input) {
  if (typeof input === "string") return { material: input };
  const files = fileBlocks(input);
  const fields = {};
  for (const [key, value] of Object.entries(input ?? {})) {
    if (key === "attachments") continue;
    fields[key] = compactValue(value, files);
  }
  return fields;
}

export function buildAgentPrompt(node, input, skills = []) {
  const fields = compactFields(input);
  const files = fileBlocks(input);
  const allowedTools = stepTools(node);
  // Users write plain instructions: mapped inputs are delivered as a block at
  // the very start of the message, so no {{input.key}} placeholder is required.
  // Fields that the prompt does inline via a placeholder are excluded here to
  // avoid saying the same value twice.
  const inlined = new Set(
    [...(node.prompt ?? "").matchAll(/\{\{(?:input|node)\.([a-zA-Z0-9_-]+)\}\}/g)].map((m) => m[1]),
  );
  const resourceKeys = new Set(Object.entries(node.input ?? {}).filter(([, ref]) => ['skill', 'file'].includes(ref?.resourceKind)).map(([key]) => key));
  const material = Object.entries(fields)
    .filter(([key]) => !inlined.has(key))
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value, null, 2)}`)
    .join("\n\n");
  const fileNote = files.length
    ? `Attached files — read these attachments; do not expect their contents to be inlined in the prompt:\n${files
        .map(
          (a) =>
            `- ${a.attachment.name ?? "file"} (${a.attachment.mediaType ?? a.type}, ${a.attachment.bytes ?? 0} bytes)`,
        )
        .join("\n")}`
    : "";
  const text = [
    material,
    renderPrompt(node.prompt, fields, resourceKeys),
    ...skills.map((s) => s.path ? `Skill ${s.name} is available at ${s.path}. Follow its instructions below; read supporting files only when needed.\n${s.content}` : s.content).filter(Boolean),
    fileNote,
    `This workflow step may use only these tools: ${JSON.stringify(allowedTools)}. Do not delegate, read files, or use any other tool unless it is listed. When delegating, follow the roles, material boundaries and dependencies specified in the step prompt. Give each child only its assigned material and wait for its result before completing. Work directly from the supplied material and attached files.`,
    node.outputSchema
      ? `Return only a JSON object matching this schema: ${JSON.stringify(node.outputSchema)}. No preface or afterword.`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return [{ type: "text", text }, ...files];
}

export function harnessAdapter(ctx, options = {}) {
  const workflowParents = new Set();
  // Presets may register per-session tools after the child's inherited filter.
  // A monotonic execution guard also covers that session-owned surface.
  ctx.tools?.guard?.(({ agent, name }) => {
    // Find the owning workflow step, including prompt-created descendants.
    let owner = agent;
    const seen = new Set();
    while (owner && !workflowParents.has(owner.session.header.parentSession)) {
      const parentId = owner.session.header.parentSession;
      if (!parentId || seen.has(parentId)) return;
      seen.add(parentId);
      owner = ctx.agents?.get?.(parentId);
    }
    if (!owner) return;
    const descriptor = owner.session.snapshotEvents().find(e => e.type === 'subagent/descriptor')?.data;
    const allowed = descriptor?.toolFilter?.allow;
    const ownDescriptor = agent.session.snapshotEvents().find(e => e.type === 'subagent/descriptor')?.data;
    if (ownDescriptor?.mode === 'one-shot' && name === 'structured_output') return;
    if (allowed && !allowed.includes(name)) return 'WORKFLOW_TOOL_NOT_ALLOWED';
  });
  return {
    async publish(input, signal) { return publishHalo(input, options.haloConfigPath, signal); },
    async file(path, name) { return { type: 'file', attachment: await ctx.attachments.saveFile({ data: await readFile(path), name }) }; },
    rootRoute(parent) {
      const selection = ctx.sessionProjections.stateOf(
        parent.session,
        "modelSelection",
      );
      const route = selection?.pending ?? selection?.lastUsed ?? parent.options;
      return {
        provider: route.provider,
        model: route.model,
        ...(route.reasoningEffort
          ? { reasoningEffort: route.reasoningEffort }
          : {}),
      };
    },
    async route(node, root, signal) {
      const executor = node.executor ?? "spawn";
      const backend = ctx.subagents.getProvider(executor);
      if (!backend) fail("EXECUTOR_UNAVAILABLE", executor);
      if (
        !backend.capabilities.agentOptions ||
        !backend.capabilities.toolFilter ||
        (node.outputSchema && !backend.capabilities.outputSchema)
      )
        fail("EXECUTOR_CAPABILITY", executor);
      const value = {
        provider:
          node.provider?.mode === "explicit" ? node.provider.id : root.provider,
        model: node.model?.mode === "explicit" ? node.model.id : root.model,
        reasoningEffort:
          node.effort?.mode === "explicit"
            ? node.effort.id
            : root.reasoningEffort,
      };
      if (!value.provider || !value.model) fail("MODEL_REQUIRED");
      const resolved = await ctx.llm.resolveCallConfig(value, signal);
      return { executor, ...resolved };
    },
    async skills(names, parent, signal) {
      const result = [];
      for (const name of names) {
        const skill = await ctx.skills.get(name, {
          cwd: parent.session.header.cwd,
          signal,
        });
        if (!skill) fail("SKILL_UNAVAILABLE", name);
        result.push({
          name,
          content: skill.content,
          hash: hash(skill.content),
        });
      }
      return result;
    },
    async agent(node, input, route, skills, parent, signal, hooks = {}) {
      workflowParents.add(parent.session.id);
      const allowedTools = stepTools(node);
      const { executor, ...agentOptions } = route;
      const prompt = buildAgentPrompt(node, input, skills);
      if (hooks.sessionId && !ctx.subagents.getProvider(executor)?.prepareContinuable) fail('SESSION_CONTINUATION_UNSUPPORTED');
      if (ctx.subagents.getProvider(executor)?.prepareContinuable) {
        const started = hooks.sessionId ? { childId: hooks.sessionId } : await ctx.agents.withInitiator(parent, () => ctx.subagents.startContinuable({
          provider: executor, label: node.name, signal,
          request: { parent, agentOptions, toolFilter: { allow: allowedTools }, prompt },
        }));
        const child = ctx.agents.get(started.childId);
        if (!child) fail("STEP_SESSION_UNAVAILABLE");
        if (hooks.sessionId) await ctx.subagents.prompt({ requestId: uid('review'), parentSessionId: parent.session.id, childSessionId: hooks.sessionId, mode: 'continuable', delivery: 'queue', content: prompt }, signal);
        hooks.onSession?.({ sessionId: started.childId, executor, continuable: true });
        const cancel = () => child.cancel({ kind: "parent" });
        signal.addEventListener("abort", cancel, { once: true });
        if (signal.aborted) cancel();
        try {
          await child.whenIdle();
          signal.throwIfAborted();
          const events = child.session.snapshotEvents();
          const end = [...events].reverse().find(e => e.type === 'turn/end');
          if (end?.data.reason?.kind !== 'completed') fail('NODE_EXECUTION_FAILED', end?.data.reason?.kind ?? 'missing-result');
          const last = [...events].reverse().find(e => e.type === 'assistant/message' && e.data.message.content.length);
          const text = last?.data.message.content.filter(b => b.type === 'text').map(b => b.text).join('\n') ?? '';
          if (node.outputSchema) {
            try { return parseStructuredOutput(text); } catch {
              await ctx.subagents.prompt({ requestId: uid('format'), parentSessionId: parent.session.id, childSessionId: started.childId, mode: 'continuable', delivery: 'queue', content: [{ type: 'text', text: `Your final result was not valid JSON. Return the same substantive result as valid JSON only. Escape backslashes and newlines correctly; Markdown escapes such as backslash-star must be doubled in JSON strings. Do not change the score or facts. Schema: ${JSON.stringify(node.outputSchema)}` }] }, signal);
              await child.whenIdle();
              signal.throwIfAborted();
              const repaired = child.session.snapshotEvents();
              if ([...repaired].reverse().find(e => e.type === 'turn/end')?.data.reason?.kind !== 'completed') fail('NODE_EXECUTION_FAILED');
              const message = [...repaired].reverse().find(e => e.type === 'assistant/message');
              return parseStructuredOutput(message?.data.message.content.filter(b => b.type === 'text').map(b => b.text).join('\n') ?? '');
            }
          }
          return { text };
        } finally { signal.removeEventListener('abort', cancel); hooks.onTrace?.(child.session.snapshotEvents()); }
      }
      const child = await ctx.agents.withInitiator(parent, () =>
        ctx.subagents.start(executor, {
          label: node.name,
          parent,
          signal,
          agentOptions,
          toolFilter: { allow: allowedTools },
          ...(node.outputSchema ? { outputSchema: node.outputSchema } : {}),
          prompt,
        }),
      );
      hooks.onSession?.({ sessionId: child.localAgent ? child.id : null, executor: route.executor });
      try {
        const result = await child.result;
        if (result.stopReason !== "completed")
          fail("NODE_EXECUTION_FAILED", result.stopReason);
        if (node.outputSchema) {
          if (result.structured === undefined)
            fail("STRUCTURED_OUTPUT_MISSING");
          return result.structured;
        }
        return {
          text: result.output
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("\n"),
        };
      } finally {
        if (child.localAgent) hooks.onTrace?.(child.localAgent.session.snapshotEvents());
        await child.dispose();
      }
    },
    async tool(name, input, parent, signal) {
      if (name === "workflow_studio") fail("RECURSIVE_TOOL");
      const result = await ctx.agents.withInitiator(parent, () =>
        ctx.tools.execute({
          name,
          arguments: input,
          agent: parent,
          signal,
          callId: uid("wf-tool"),
        }),
      );
      if (result.isError) fail("TOOL_EXECUTION_FAILED", name);
      return result.value ?? { content: result.content };
    },
  };
}

export function parseStructuredOutput(text) {
  try { return JSON.parse(text.trim()); } catch {}
  const blocks = [...text.matchAll(/```json\s*\n([\s\S]*?)\n```/g)];
  if (blocks.length === 1) {
    try { return JSON.parse(blocks[0][1]); } catch {}
  }
  fail('STRUCTURED_OUTPUT_MISSING');
}

export async function materialInput(ctx, messages, signal) {
  const text = [];
  const attachments = [];
  for (const message of messages)
    for (const block of message.content) {
      if (block.type === "text" && typeof block.text === "string") text.push(block.text);
      if (block.type !== "file" && block.type !== "image") continue;
      const ref = block.attachment;
      if (!ref?.attachmentId) continue;
      if (ref.bytes > 30 * 1024 * 1024) fail("MATERIAL_SIZE_LIMIT");
      attachments.push({
        type: block.type === "image" ? "image" : "file",
        attachment: ref,
        id: ref.attachmentId,
        name: ref.name,
      });
    }
  const combined = text.join("\n\n").trim();
  if (!combined && !attachments.length) fail("MATERIAL_TEXT_REQUIRED");
  const inventory = attachments
    .map((a) => `[attached:${a.name ?? a.id}]`)
    .join("\n");
  const result = combined || `User uploaded ${attachments.length} file(s).\n${inventory}`;
  if (result.length > 800000) fail("MATERIAL_TEXT_LIMIT");
  signal?.throwIfAborted?.();
  return { text: result, attachments };
}
