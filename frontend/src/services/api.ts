/**
 * API client for FlowForge.
 *
 * Builds against the offline mock by default (`services/mock.ts`). Set
 * `VITE_USE_MOCK=false` (and optionally `VITE_API_BASE`) to talk to the real
 * FastAPI backend via the Vite dev proxy (`/api` -> :8000).
 */

import type {
  AdvanceRequest,
  AdvanceResponse,
  AuditResponse,
  CreateWorkflowResult,
  DocumentUploadResult,
  WorkflowDetail,
} from "../types";
import { mockApi } from "./mock";

export interface FlowForgeApi {
  createWorkflow(goal: string): Promise<CreateWorkflowResult>;
  getWorkflow(workflowId: string): Promise<WorkflowDetail>;
  advance(workflowId: string, req: AdvanceRequest): Promise<AdvanceResponse>;
  uploadDocument(workflowId: string, file: File): Promise<DocumentUploadResult>;
  listAudit(workflowId: string): Promise<AuditResponse>;
}

// Default to HttpApi against real backend; MockApi only when VITE_USE_MOCK="true"
const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";
export const API_BASE = (import.meta.env.VITE_API_BASE ?? "/api").replace(/\/$/, "");

class HttpApi implements FlowForgeApi {
  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}${path}`, init);
    } catch {
      throw new Error("Cannot reach the FlowForge backend.");
    }
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = (await res.json()) as { detail?: unknown };
        if (typeof body.detail === "string") detail = body.detail;
      } catch {
        // fall back to status text
      }
      throw new Error(detail);
    }
    return (await res.json()) as T;
  }

  createWorkflow(goal: string): Promise<CreateWorkflowResult> {
    return this.request("/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal }),
    });
  }

  getWorkflow(workflowId: string): Promise<WorkflowDetail> {
    return this.request(`/workflows/${workflowId}`);
  }

  advance(workflowId: string, req: AdvanceRequest): Promise<AdvanceResponse> {
    return this.request(`/workflows/${workflowId}/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
  }

  uploadDocument(workflowId: string, file: File): Promise<DocumentUploadResult> {
    const form = new FormData();
    form.append("file", file);
    return this.request(`/workflows/${workflowId}/documents`, {
      method: "POST",
      body: form,
    });
  }

  listAudit(workflowId: string): Promise<AuditResponse> {
    return this.request(`/workflows/${workflowId}/audit`);
  }
}

class MockApi implements FlowForgeApi {
  async createWorkflow(goal: string): Promise<CreateWorkflowResult> {
    return mockApi.createWorkflow(goal);
  }

  async getWorkflow(): Promise<WorkflowDetail> {
    return mockApi.getWorkflow();
  }

  async advance(_workflowId: string, req: AdvanceRequest): Promise<AdvanceResponse> {
    return mockApi.advance(req);
  }

  async uploadDocument(_workflowId: string, file: File): Promise<DocumentUploadResult> {
    return mockApi.uploadDocument(_workflowId, file);
  }

  async listAudit(_workflowId: string): Promise<AuditResponse> {
    return mockApi.listAudit();
  }
}

export function createApi(): FlowForgeApi {
  return USE_MOCK ? new MockApi() : new HttpApi();
}