import { useCallback, useState } from "react";
import { createApi, type FlowForgeApi } from "@/services/api";
import type {
  AdvanceRequest,
  AdvanceResponse,
  AuditEvent,
  DocumentUploadResult,
  WorkflowDefinition,
  WorkflowDetail,
  WorkflowStatus,
} from "@/types";

export type DemoPhase = "goal" | "plan" | "documents" | "review" | "submit" | "done";

export interface WorkflowHookState {
  workflowId: string | null;
  plan: WorkflowDefinition | null;
  detail: WorkflowDetail | null;
  documents: DocumentUploadResult[];
  audit: AuditEvent[];
  phase: DemoPhase;
  doneStatus: WorkflowStatus | null;
  busy: boolean;
  error: string | null;
  confirmationId?: string;
  lastGoal: string;
  reviewed: boolean;
}

const initialState: WorkflowHookState = {
  workflowId: null,
  plan: null,
  detail: null,
  documents: [],
  audit: [],
  phase: "goal",
  doneStatus: null,
  busy: false,
  error: null,
  lastGoal: "",
  reviewed: false,
};

function phaseFor(detail: WorkflowDetail | null, reviewed: boolean): DemoPhase {
  if (!detail) return "goal";
  if (detail.status !== "in_progress") return "done";
  if (detail.needs === "document_upload") return "documents";
  if (detail.needs === "approval") {
    if (detail.current_state === "review_warnings") return "review";
    // a pass arrives at final_approval: show the review summary once, then
    // "Continue to submit" moves the UI to the submit step without an API call.
    if (detail.validation?.status === "pass" && !reviewed) return "review";
    return "submit";
  }
  return "plan";
}

function confirmationFrom(res: AdvanceResponse): string | undefined {
  const execution = res.events.find((e) => e.event_type === "execution");
  const conf = execution?.details.confirmation_id;
  return typeof conf === "string" ? conf : undefined;
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

function auditKey(e: AuditEvent): string {
  return `${e.event_type}|${e.timestamp}|${JSON.stringify(e.details ?? {})}`;
}

/** Merge audit lists, de-duplicating, newest first. */
function mergeAudit(lists: (AuditEvent[] | undefined)[]): AuditEvent[] {
  const map = new Map<string, AuditEvent>();
  for (const list of lists) {
    for (const e of list ?? []) map.set(auditKey(e), e);
  }
  return [...map.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function useWorkflow() {
  const [api] = useState<FlowForgeApi>(() => createApi());
  const [state, setState] = useState<WorkflowHookState>(initialState);

  const refreshAudit = useCallback(
    async (workflowId: string): Promise<AuditEvent[]> => {
      try {
        const res = await api.listAudit(workflowId);
        return res.events ?? [];
      } catch {
        return [];
      }
    },
    [api],
  );

  /** Create the plan only. The user reviews it before it is started. */
  const start = useCallback(
    async (goal: string): Promise<DemoPhase> => {
      setState((prev) => ({ ...prev, busy: true, error: null }));
      try {
        const created = await api.createWorkflow(goal);
        const events = await refreshAudit(created.workflow_id);
        setState((prev) => ({
          ...prev,
          workflowId: created.workflow_id,
          plan: created.workflow,
          detail: null,
          documents: [],
          audit: mergeAudit([prev.audit, events]),
          phase: "plan",
          doneStatus: null,
          busy: false,
          error: null,
          lastGoal: goal,
          reviewed: false,
        }));
        return "plan";
      } catch (err) {
        setState((prev) => ({ ...prev, busy: false, error: toMessage(err) }));
        return "goal";
      }
    },
    [api, refreshAudit],
  );

  /** Start executing a plan the user has reviewed. */
  const begin = useCallback(async (): Promise<DemoPhase> => {
    if (!state.workflowId) return "goal";
    setState((prev) => ({ ...prev, busy: true, error: null }));
    try {
      const res = await api.advance(state.workflowId, {});
      const events = await refreshAudit(state.workflowId);
      const phase = phaseFor(res, false);
      setState((prev) => ({
        ...prev,
        detail: res,
        phase,
        doneStatus: res.status !== "in_progress" ? res.status : null,
        confirmationId: confirmationFrom(res),
        audit: mergeAudit([prev.audit, res.events, events]),
        busy: false,
        error: null,
        reviewed: false,
      }));
      return phase;
    } catch (err) {
      setState((prev) => ({ ...prev, busy: false, error: toMessage(err) }));
      return "plan";
    }
  }, [api, refreshAudit, state.workflowId]);

  const advance = useCallback(
    async (req: AdvanceRequest): Promise<DemoPhase> => {
      if (!state.workflowId) return "goal";
      setState((prev) => ({ ...prev, busy: true, error: null }));
      try {
        const res = await api.advance(state.workflowId, req);
        const events = await refreshAudit(state.workflowId);
        const phase = phaseFor(res, state.reviewed);
        setState((prev) => ({
          ...prev,
          detail: res,
          phase,
          doneStatus: res.status !== "in_progress" ? res.status : null,
          confirmationId: confirmationFrom(res),
          audit: mergeAudit([prev.audit, res.events, events]),
          busy: false,
          error: null,
        }));
        return phase;
      } catch (err) {
        setState((prev) => ({ ...prev, busy: false, error: toMessage(err) }));
        return "goal";
      }
    },
    [api, refreshAudit, state.workflowId, state.reviewed],
  );

  /** Leave the review summary for the submit step (no API call; the backend
   *  is already at final_approval). */
  const passReview = useCallback((): DemoPhase => {
    setState((prev) => ({ ...prev, phase: "submit", reviewed: true }));
    return "submit";
  }, []);

  const upload = useCallback(
    async (file: File): Promise<DocumentUploadResult> => {
      if (!state.workflowId) throw new Error("Start a workflow before uploading documents.");
      setState((prev) => ({ ...prev, busy: true, error: null }));
      try {
        const result = await api.uploadDocument(state.workflowId, file);
        const fresh = await api.getWorkflow(state.workflowId);
        const events = await refreshAudit(state.workflowId);
        setState((prev) => ({
          ...prev,
          documents: [...prev.documents, result],
          ...(fresh ? { detail: fresh } : {}),
          audit: mergeAudit([prev.audit, events]),
          busy: false,
          error: null,
        }));
        return result;
      } catch (err) {
        setState((prev) => ({ ...prev, busy: false, error: toMessage(err) }));
        throw err;
      }
    },
    [api, refreshAudit, state.workflowId],
  );

  /** Return to the goal screen, keeping the previous goal for prefill. */
  const editGoal = useCallback((): DemoPhase => {
    setState((prev) => ({
      ...prev,
      workflowId: null,
      plan: null,
      detail: null,
      documents: [],
      audit: [],
      phase: "goal",
      doneStatus: null,
      confirmationId: undefined,
      busy: false,
      error: null,
    }));
    return "goal";
  }, []);

  const loadAudit = useCallback(async () => {
    if (!state.workflowId) return;
    const events = await refreshAudit(state.workflowId);
    setState((prev) => ({ ...prev, audit: mergeAudit([prev.audit, events]) }));
  }, [refreshAudit, state.workflowId]);

  const clear = useCallback(() => setState({ ...initialState }), []);

  return {
    state,
    start,
    begin,
    advance,
    passReview,
    upload,
    loadAudit,
    editGoal,
    clear,
  };
}