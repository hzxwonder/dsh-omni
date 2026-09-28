import React, { useState } from 'react';
import { Pause, Play, Square, StepForward, List } from 'lucide-react';
import { shortError } from './format.js';

const LIVE = ['queued', 'running', 'paused', 'waiting_input', 'waiting_approval', 'needs_attention'];

export function SessionRail({
  run,
  authoring,
  workflowName,
  stepSessions = [],
  api,
  refresh,
  openEditor,
  openSession,
  statuses,
}) {
  const [busy, setBusy] = useState(false);
  if (!run) return null;
  const steps = run.steps?.length
    ? run.steps
    : Object.entries(run.nodes ?? {}).map(([id, node]) => ({
        id,
        name: node.name ?? id,
        status: node.status,
      }));
  const current = steps.find((step) => LIVE.includes(step.status) && step.status !== 'queued')
    ?? steps.find((step) => step.status === 'queued')
    ?? [...steps].reverse().find((step) => step.status === 'completed')
    ?? steps.at(-1);
  const running = ['running', 'queued'].includes(run.status);
  const resumable = ['paused', 'failed', 'needs_attention', 'cancelled'].includes(run.status);
  const kind = authoring ? '试运行' : '执行';
  const headline = run.pending?.question
    ? '等待你的回答'
    : `${current?.name ?? workflowName} · ${statuses[run.status] ?? run.status}`;
  const act = async (args) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await api(args);
      await refresh?.();
      return result;
    } finally {
      setBusy(false);
    }
  };
  const openStep = async (step) => {
    const known = stepSessions.find((item) => item.runId === run.id && item.nodeId === step.id && !item.memberId);
    if (known?.sessionId) {
      openSession(known.sessionId);
      return;
    }
    try {
      const result = await act({ action: 'stepOpen', runId: run.id, nodeId: step.id });
      if (result?.sessionId) openSession(result.sessionId);
    } catch {
      /* pending steps have no session yet */
    }
  };
  return (
    <aside
      className="wf wf-session-rail"
      data-mode={authoring ? 'author' : 'run'}
      data-run-status={run.status}
      aria-label={authoring ? '试运行进度' : '工作流执行进度'}
    >
      <div className="wf-session-rail-row">
        <p className="wf-session-rail-status">
          <span className="wf-session-rail-kind">{kind}</span>
          <strong>{headline}</strong>
        </p>
        {!!steps.length && (
          <ol className="wf-session-rail-steps">
            {steps.map((step, index) => {
              const active = current?.id === step.id;
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    data-step-id={step.id}
                    data-step-status={step.status}
                    className="wf-session-rail-step"
                    aria-current={active ? 'step' : undefined}
                    aria-label={`${index + 1}. ${step.name}，${statuses[step.status] ?? step.status}`}
                    title={`${step.name} · ${statuses[step.status] ?? step.status}`}
                    disabled={busy || ["pending", "skipped", "stale"].includes(step.status)}
                    onClick={() => void openStep(step)}
                  >
                    <i data-status={step.status} aria-hidden="true" />
                    <span>{step.name}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
        <div className="wf-session-rail-actions">
          {running && (
            <>
              <button type="button" aria-label="暂停" title="暂停" disabled={busy} onClick={() => void act({ action: 'pause', id: run.id })}>
                <Pause size={14} aria-hidden="true" />
              </button>
              <button type="button" aria-label="停止" title="停止" disabled={busy} onClick={() => void act({ action: 'cancel', id: run.id })}>
                <Square size={14} aria-hidden="true" />
              </button>
            </>
          )}
          {resumable && (
            <>
              <button type="button" aria-label="运行一步" title="运行一步" disabled={busy} onClick={() => void act({ action: 'resume', runId: run.id, sessionId: run.sessionId, debug: true, response: true, background: true, expectedRevision: run.checkpointRevision })}>
                <StepForward size={14} aria-hidden="true" />
              </button>
              <button type="button" aria-label="继续执行" title="继续执行" disabled={busy} onClick={() => void act({ action: 'resume', runId: run.id, sessionId: run.sessionId, debug: false, response: true, background: true, expectedRevision: run.checkpointRevision })}>
                <Play size={14} aria-hidden="true" />
              </button>
            </>
          )}
          <button type="button" aria-label="打开运行记录" title="打开运行记录" onClick={() => openEditor(run.workflowId, 'runs')}>
            <List size={14} aria-hidden="true" />
            <span>记录</span>
          </button>
        </div>
      </div>
      {run.pending?.question && (
        <p className="wf-session-rail-ask" role="status">
          在下方回复即可：{run.pending.question}
        </p>
      )}
      {run.error && run.status !== 'running' && (
        <p className="wf-session-rail-error" role="alert" title={run.error}>{shortError(run.error)}</p>
      )}
    </aside>
  );
}
