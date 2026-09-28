// Human-facing formatting shared by the panel, the run timeline and the
// session rail: run errors become readable sentences, and the engine's event
// stream becomes a timeline a person can scan.

const ERROR_HINTS = [
  [/^RESOURCE_PATH_PLACEMENT_REQUIRED/i, "请在目标步骤的 Prompt 中选择位置并插入已连线的资源路径"],
  [/^SKILL_NAME_INVALID/i, "Skill 名称只能使用小写英文、数字和连字符"],
  [/^SKILL_NAME_DUPLICATE/i, "同一工作流中的 Skill 名称不能重复"],
  [/^SKILL_DESCRIPTION_REQUIRED/i, "请填写 Skill 的用途说明"],
  [/^SKILL_INSTRUCTIONS_REQUIRED/i, "请填写 SKILL.md 正文"],
  [/^SKILL_FILE_PATH_INVALID|^RESOURCE_PATH_INVALID/i, "文件路径无效；请使用目录内的相对路径"],
  [/^FILE_NAME_REQUIRED|^FILE_NAME_INVALID/i, "请填写有效的文件名"],
  [/^RESOURCE_BLOB_MISSING/i, "导入的文件已不可用；请重新选择本地文件"],
  [/^RESOURCE_UPLOAD_TOO_LARGE/i, "单个文件不能超过 8 MB"],
  [/^RESOURCE_REVISION_CHANGED|^RESOURCE_REVISION_CONFLICT/i, "工作流版本文件已变化；请保存为新的版本"],
  [/^NODE_EXECUTION_FAILED:\s*aborted/i, "执行被中断（可能是手动停止或会话中断）"],
  [/^NODE_EXECUTION_FAILED/i, "步骤执行失败"],
  [/^REVIEW_LIMIT/i, "已达到评审轮数上限，保留了现场"],
  [/^RUN_CONFLICT/i, "运行状态已变化，请刷新后重试"],
  [/^OUTPUT_SCHEMA/i, "输出不符合约定的格式"],
  [/^CALL_BUDGET/i, "达到调用预算上限"],
  [/^INTERACTION_UNATTENDED/i, "交互步骤需要真人，无人值守运行已停止"],
  [/^GRAPH_BLOCKED/i, "上游步骤未完成，流程被阻塞"],
  [/^WORKSPACE_BUSY/i, "同一工作区有其他运行正在进行"],
  [/^TIMEOUT|timed out/i, "执行超时"],
  [/^RATE_LIMIT|429/i, "模型限流，稍后会自动重试"],
];

export const shortError = (message = "") => {
  const text = String(message);
  const hint = ERROR_HINTS.find(([re]) => re.test(text));
  return hint ? hint[1] : text.split("\n")[0].slice(0, 80);
};

// `NODE_EXECUTION_FAILED: aborted` carries no node name; the event stream does.
// Combine the failed node from events with the friendly hint for one sentence.
export const describeRunError = (run, events = []) => {
  if (!run?.error) return null;
  const failure = [...events]
    .reverse()
    .find((event) => event.type === "node.failed");
  const name = failure?.nodeId ? run.nodes?.[failure.nodeId]?.name : null;
  const cause = shortError(run.error);
  return name ? `步骤「${name}」未能完成：${cause}` : `运行未能完成：${cause}`;
};

export const EVENT_LABELS = {
  "run.queued": "运行已排队",
  "run.started": "运行开始",
  "run.completed": "运行完成",
  "run.failed": "运行失败",
  "run.cancelled": "运行已停止",
  "run.paused": "运行已暂停",
  "run.needs_attention": "运行需要处理",
  "run.interrupted": "运行被中断",
  "run.rewound": "已回退后续步骤",
  "run.debug_changed": "逐步调试开关已切换",
  "node.started": "开始执行",
  "node.completed": "执行完成",
  "node.failed": "执行失败",
  "node.skipped": "已跳过",
  "node.waiting_approval": "等待确认",
  "node.waiting_input": "等待你的回答",
  "node.session": "步骤会话已建立",
  "node.interaction_checkpoint": "交互检查点",
  "node.interaction_limit": "达到交互轮数上限",
  "node.input_edited": "步骤输入已修改",
  "node.review_session": "检视会话已建立",
  "node.review_ready": "检视就绪",
  "node.followup_completed": "步骤交流完成",
  "node.output_adopted": "已采纳步骤输出",
  "message.delivered": "消息已送达步骤",
  "subagent.started": "子代理启动",
  "subagent.settled": "子代理完成",
  "review.completed": "评审完成",
  "review.repeating": "评审未通过，返回修订",
};

const EVENT_DETAIL = (event, nodeNames = {}) => {
  const name = event.nodeId ? nodeNames[event.nodeId] ?? event.nodeId : "";
  switch (event.type) {
    case "node.failed":
      return [name, shortError(event.error ?? "")].filter(Boolean).join(" · ");
    case "node.waiting_input":
      return [name, event.question].filter(Boolean).join(" · ");
    case "node.input_edited":
    case "node.started":
    case "node.completed":
    case "node.skipped":
    case "node.waiting_approval":
    case "node.interaction_limit":
    case "node.interaction_checkpoint":
    case "node.session":
    case "node.review_session":
    case "node.review_ready":
    case "node.followup_completed":
    case "node.output_adopted":
    case "message.delivered":
      return name;
    case "subagent.started":
    case "subagent.settled":
      return event.name ?? "";
    case "review.repeating":
      return event.round ? `第 ${event.round} 轮` : "";
    default:
      return "";
  }
};

export const eventTime = (time) =>
  time ? new Date(time).toLocaleTimeString([], { hour12: false }) : "";

export const eventLine = (event, nodeNames = {}) => ({
  time: eventTime(event.time),
  label: EVENT_LABELS[event.type] ?? event.type,
  detail: EVENT_DETAIL(event, nodeNames),
});

// Node cards and outlines show prompts to people, not to the engine: inline
// {{input.key}} placeholders are engine syntax and render as material chips
// next to the prompt anyway, so hide them in prose.
export const displayPrompt = (prompt = "") =>
  String(prompt ?? "")
    .replace(/\s*\{\{(?:input|node)\.[a-zA-Z0-9_-]+\}\}\s*/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
