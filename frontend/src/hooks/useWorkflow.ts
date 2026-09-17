import { useCallback, useState } from "react";
import { createApi, type FlowForgeApi } from "@/services/api";
import type {
  AdvanceRequest,
  AdvanceResponse,
  AuditEvent,
  DocumentUploadResult,
  WorkflowDetail,
} from "@/types";

export type DemoPhase = "goal" | "documents" | "review" | "approval" | "done";

export interface WorkflowState {
  workflowId: string | null;
  detail: WorkflowDetail | null;
  documents: DocumentUploadResult[];
  audit: AuditEvent[];
  phase: DemoPhase;
  busy: boolean;
  error: string | null;
  confirmationId?: string;
}

const initialState: WorkflowState = {
  workflowId: null,
  detail: null,
  documents: [],
  audit: [],
  phase: "goal",
  busy: false,
  error: null,
};

function phaseFor(detail: WorkflowDetail | null): DemoPhase {
  if (!detail) return "goal";
  if (detail.status !== "in_progress") return "done";
  if (detail.needs === "document_upload") return "documents";
  if (detail.needs === "approval") {
    return detail.current_state === "review_warnings" ? "review" : "approval";
  }
  return "goal";
}

function confirmationFrom(res: AdvanceResponse): string | undefined {
  const execution = res.events.find((e) => e.event_type === "execution");
  const conf = execution?.details.confirmation_id;
  return typeof conf === "string" ? conf : undefined;
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

export function useWorkflow() {
  const [api] = useState<FlowForgeApi>(() => createApi());
  const [state, setState] = useState<WorkflowState>(initialState);

  const start = useCallback(
    async (goal: string): Promise<void> => {
      setState((prev) => ({ ...prev, busy: true, error: null }));
      try {
        const created = await api.createWorkflow(goal);
        const res = await api.advance(created.workflow_id, {});
        setState((prev) => {
          const createdEvent: AuditEvent = {
            timestamp: new Date().toISOString(),
            workflow_id: created.workflow_id,
            event_type: "workflow_created",
            details: { goal },
          };
          return {
            ...prev,
            workflowId: created.workflow_id,
            detail: res,
            phase: phaseFor(res),
            confirmationId: confirmationFrom(res),
            audit: [createdEvent, ...res.events, ...prev.audit],
            busy: false,
            error: null,
          };
        });
      } catch (err) {
        setState((prev) => ({ ...prev, busy: false, error: toMessage(err) }));
      }
    },
    [api],
  );

  const advance = useCallback(
    async (req: AdvanceRequest): Promise<void> => {
      if (!state.workflowId) return;
      setState((prev) => ({ ...prev, busy: true, error: null }));
      try {
        const res = await api.advance(state.workflowId, req);
        setState((prev) => ({
          ...prev,
          detail: res,
          phase: phaseFor(res),
          confirmationId: confirmationFrom(res),
          audit: [...res.events, ...prev.audit],
          busy: false,
          error: null,
        }));
      } catch (err) {
        setState((prev) => ({ ...prev, busy: false, error: toMessage(err) }));
      }
    },
    [api, state.workflowId],
  );

  const upload = useCallback(
    async (file: File): Promise<DocumentUploadResult> => {
      if (!state.workflowId) throw new Error("No workflow started");
      const result = await api.uploadDocument(state.workflowId, file);
      const fresh = await api.getWorkflow(state.workflowId);
      setState((prev) => ({
        ...prev,
        documents: [...prev.documents, result],
        ...(fresh ? { detail: fresh } : {}),
      }));
      return result;
    },
    [api, state.workflowId],
  );

  const loadAudit = useCallback(async () => {
    if (!state.workflowId) return;
    const res = await api.listAudit(state.workflowId);
    setState((prev) => ({ ...prev, audit: res.events }));
  }, [api, state.workflowId]);

  const clear = useCallback(() => setState(initialState), []);

  return { state, start, advance, upload, loadAudit, clear };
}