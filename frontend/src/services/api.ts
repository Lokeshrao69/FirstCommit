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
import { ApiError } from "./errors";
import { fetchJson } from "./http";
import { mockApi } from "./mock";
import {
  normalizeAdvance,
  normalizeAudit,
  normalizeCreate,
  normalizeDetail,
  normalizeUpload,
} from "./normalize";

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

const JSON_HEADERS = { "Content-Type": "application/json", Accept: "application/json" };

class HttpApi implements FlowForgeApi {
  private url(path: string): string {
    return `${API_BASE}${path}`;
  }

  async createWorkflow(goal: string): Promise<CreateWorkflowResult> {
    const raw = await fetchJson<unknown>(this.url("/workflows"), {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ goal }),
      timeoutMs: 60_000,
    });
    return normalizeCreate(raw);
  }

  async getWorkflow(workflowId: string): Promise<WorkflowDetail> {
    const raw = await fetchJson<unknown>(this.url(`/workflows/${encodeURIComponent(workflowId)}`), {
      headers: { Accept: "application/json" },
      retries: 2,
    });
    return normalizeDetail(raw);
  }

  async advance(workflowId: string, req: AdvanceRequest): Promise<AdvanceResponse> {
    const raw = await fetchJson<unknown>(this.url(`/workflows/${encodeURIComponent(workflowId)}/advance`), {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(req),
      timeoutMs: 30_000,
    });
    return normalizeAdvance(raw);
  }

  async uploadDocument(workflowId: string, file: File): Promise<DocumentUploadResult> {
    const form = new FormData();
    form.append("file", file, file.name);
    const raw = await fetchJson<unknown>(this.url(`/workflows/${encodeURIComponent(workflowId)}/documents`), {
      method: "POST",
      body: form,
      headers: { Accept: "application/json" },
      timeoutMs: 90_000,
    });
    return normalizeUpload(raw);
  }

  async listAudit(workflowId: string): Promise<AuditResponse> {
    const raw = await fetchJson<unknown>(this.url(`/workflows/${encodeURIComponent(workflowId)}/audit`), {
      headers: { Accept: "application/json" },
      retries: 2,
    });
    return normalizeAudit(raw);
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

export { ApiError };