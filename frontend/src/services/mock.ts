/**
 * Deterministic offline mock of the FlowForge backend.
 *
 * Replicates the `DEMO_MODE` behavior of `backend/app/services/workflow_service.py`
 * for the three demo services (post-matric scholarship, old-age pension, income
 * certificate) so the frontend builds against mocks first.
 *
 * Demo rules (mirrors the backend mock provider and `document_requirements.json`):
 *  - service is resolved from the goal text (pension / income certificate / else scholarship)
 *  - uploaded files are classified by filename against the eval corpus
 *  - `income_certificate_over_limit.pdf`   -> income over the limit          => block
 *  - `income_certificate_expired.pdf`      -> expired certificate            => block
 *  - `income_certificate_name_mismatch.pdf` / `aadhaar_name_mismatch.pdf`    => block
 *  - `aadhaar_too_young.pdf`               -> applicant under 60             => block (pension)
 *  - `ration_card_apl.pdf`                 -> not BPL                        => block (pension)
 *  - `income_self_declaration_stale.pdf`   -> declaration older than 180 days => needs_review
 *  - `income_self_declaration_over_limit.pdf` -> income over the limit       => block
 *  - everything else passes
 */

import type {
  AdvanceRequest,
  AdvanceResponse,
  AuditEvent,
  AuditResponse,
  CreateWorkflowResult,
  DocumentUploadResult,
  ValidationResult,
  WorkflowDetail,
  WorkflowState,
} from "../types";

export const GOAL_EXAMPLES = [
  "Apply for a post-matric scholarship",
  "Apply for my old-age pension",
  "Get an income certificate for my scholarship application",
];

type Service = "post_matric_scholarship" | "old_age_pension" | "income_certificate";

const SERVICE_REQUIRED: Record<Service, string[]> = {
  post_matric_scholarship: ["aadhaar", "income_certificate", "marks_memo", "bonafide_certificate", "bank_passbook"],
  old_age_pension: ["aadhaar", "ration_card", "bank_passbook"],
  income_certificate: ["aadhaar", "income_self_declaration"],
};

const SERVICE_LABEL: Record<Service, string> = {
  post_matric_scholarship:
    "Upload your Aadhaar, income certificate, marks memo, bonafide certificate and bank passbook.",
  old_age_pension:
    "Upload your Aadhaar, ration card and bank passbook to verify your pension eligibility.",
  income_certificate:
    "Upload your Aadhaar and a fresh income self-declaration to issue an income certificate.",
};

function serviceFor(goal: string): Service {
  const g = goal.toLowerCase();
  if (g.includes("pension")) return "old_age_pension";
  if (g.includes("income cert") || g.includes("self declaration")) return "income_certificate";
  return "post_matric_scholarship";
}

interface Session {
  workflowId: string;
  goal: string;
  service: Service;
  status: WorkflowDetail["status"];
  current: string | null;
  states: Record<string, WorkflowState>;
  collected: string[];
  validation: ValidationResult | null;
  docs: Record<string, DocumentUploadResult>;
  audit: AuditEvent[];
}

interface SeedState extends Omit<WorkflowState, "status"> {
  status?: WorkflowState["status"];
}

function seedStates(service: Service): Record<string, WorkflowState> {
  const raw: SeedState[] = [
    {
      id: "document_collection",
      label: "Documents",
      type: "document_required",
      description: SERVICE_LABEL[service],
      required_data: [],
      required_documents: SERVICE_REQUIRED[service],
      transitions: [{ target: "document_validation", condition: "documents_ready" }],
    },
    {
      id: "document_validation",
      label: "Validation",
      type: "validation",
      description: "AI-assisted cross-document validation of extracted fields.",
      required_data: [],
      required_documents: [],
      transitions: [
        { target: "final_approval", condition: "validation_passed" },
        { target: "review_warnings", condition: "validation_needs_review" },
        { target: "blocked", condition: "validation_blocked" },
      ],
    },
    {
      id: "review_warnings",
      label: "Resolve Warning",
      type: "human_approval",
      description:
        "A potential eligibility issue was detected. Acknowledge to continue, or correct your documents.",
      required_data: [],
      required_documents: [],
      transitions: [
        { target: "final_approval", condition: "approval_granted" },
        { target: "document_collection", condition: "approval_rejected" },
      ],
    },
    {
      id: "blocked",
      label: "Blocked",
      type: "terminal",
      description: "Validation failed fatally. No submission will be attempted.",
      required_data: [],
      required_documents: [],
      transitions: [],
    },
    {
      id: "final_approval",
      label: "Approval",
      type: "human_approval",
      description:
        "Human approval is required before submission. Nothing is submitted without your explicit consent.",
      required_data: [],
      required_documents: [],
      transitions: [
        { target: "submission", condition: "approval_granted" },
        { target: "cancelled", condition: "approval_rejected" },
      ],
    },
    {
      id: "cancelled",
      label: "Cancelled",
      type: "terminal",
      description: "Submission was declined by the user.",
      required_data: [],
      required_documents: [],
      transitions: [],
    },
    {
      id: "submission",
      label: "Submission",
      type: "execution",
      description: "Submitting the assembled application (simulated in demo).",
      required_data: [],
      required_documents: [],
      transitions: [{ target: "completed", condition: "submission_complete" }],
    },
    {
      id: "completed",
      label: "Completed",
      type: "terminal",
      description: "Application submitted successfully.",
      required_data: [],
      required_documents: [],
      transitions: [],
    },
  ];
  const out: Record<string, WorkflowState> = {};
  for (const s of raw) {
    out[s.id] = { ...s, status: s.status ?? "pending" };
  }
  return out;
}

let session: Session | null = null;

function now(): string {
  return new Date().toISOString();
}

function activate(id: string, events: AuditEvent[]) {
  if (!session) return;
  session.current = id;
  const s = session.states[id];
  if (s && s.status === "pending") {
    s.status = "active";
    events.push(audit("state_activated", { from_state: null, to_state: id }));
  }
}

function complete(id: string) {
  const s = session?.states[id];
  if (s) s.status = "completed";
}

function transition(from: string, to: string, events: AuditEvent[]) {
  if (!session) return;
  complete(from);
  activate(to, events);
}

function audit(event_type: AuditEvent["event_type"], extra: Partial<AuditEvent> = {}): AuditEvent {
  return {
    timestamp: now(),
    workflow_id: session?.workflowId ?? "",
    event_type,
    details: {},
    ...extra,
  };
}

function advances(): AdvanceResponse {
  if (!session) throw new Error("no active session");
  const s = session;
  const states = Object.values(s.states);
  const completedCount = states.filter(
    (x) => x.status === "completed" || (x.type === "terminal" && s.current === x.id),
  ).length;
  const total = states.length;
  const active = states.find((x) => x.status === "active");
  const needs =
    s.status === "in_progress" && active
      ? active.type === "document_required"
        ? "document_upload"
        : active.type === "human_approval"
          ? "approval"
          : active.type === "user_input"
            ? "user_input"
            : null
      : null;

  return {
    workflow_id: s.workflowId,
    status: s.status,
    goal: s.goal,
    current_state: s.current,
    needs,
    progress: {
      completed: completedCount,
      total,
      ratio: Number((completedCount / total).toFixed(3)),
    },
    states: Object.values(s.states),
    collected_documents: [...s.collected].sort(),
    validation: s.validation,
    completed: s.status !== "in_progress",
    events: [],
  };
}

function workflowResult(events: AuditEvent[]) {
  const r = advances();
  r.events = events;
  return r;
}

export const mockApi = {
  async createWorkflow(goal: string): Promise<CreateWorkflowResult> {
    await delay();
    const id = `wf_${Math.floor(Math.random() * 0xffffffff).toString(16)}`;
    session = {
      workflowId: id,
      goal,
      service: serviceFor(goal),
      status: "in_progress",
      current: null,
      states: seedStates(serviceFor(goal)),
      collected: [],
      validation: null,
      docs: {},
      audit: [audit("workflow_created", { details: { goal } })],
    };
    return {
      workflow_id: id,
      status: session.status,
      workflow: {
        workflow_id: id,
        goal,
        initial_state: "document_collection",
        terminal_states: ["completed", "cancelled", "blocked"],
        states: Object.values(session.states),
      },
    };
  },

  async getWorkflow(): Promise<WorkflowDetail> {
    await delay(120);
    return advances();
  },

  async advance(req: AdvanceRequest): Promise<AdvanceResponse> {
    await delay(420);
    if (!session) throw new Error("no active session");
    if (session.status !== "in_progress") return advances();

    const events: AuditEvent[] = [];
    let current = Object.values(session.states).find((s) => s.status === "active");

    if (!current) {
      activate("document_collection", events);
      current = session.states.document_collection;
    }

    type RunOutcome = { pause: "document_upload" | "approval" | "terminal" | null };

    const run = (stateId: string): RunOutcome => {
      const s = session!.states[stateId];
      if (s.type === "document_required") {
        const missing = s.required_documents.filter((d) => !session!.collected.includes(d));
        if (missing.length > 0) return { pause: "document_upload" };
        complete(stateId);
        transition(stateId, "document_validation", events);
        return runValidation();
      }
      if (s.type === "human_approval") {
        const granted = req.approval === true || req.acknowledge === true;
        const rejected = req.approval === false || req.acknowledge === false;
        if (!granted && !rejected) {
          s.status = "active";
          return { pause: "approval" };
        }
        events.push(
          audit("human_approval", {
            from_state: stateId,
            details: { approved: granted, state: stateId },
          }),
        );
        if (granted) {
          complete(stateId);
          if (stateId === "review_warnings") {
            transition(stateId, "final_approval", events);
            return run("final_approval");
          }
          transition(stateId, "submission", events);
          return run("submission");
        }
        complete(stateId);
        if (stateId === "review_warnings") {
          transition(stateId, "document_collection", events);
          session!.current = "document_collection";
          session!.states.document_collection.status = "active";
          return { pause: "document_upload" };
        }
        transition(stateId, "cancelled", events);
        session!.status = "cancelled";
        session!.current = "cancelled";
        return { pause: "terminal" };
      }
      if (s.type === "execution") {
        complete(stateId);
        events.push(
          audit("execution", {
            from_state: stateId,
            details: {
              confirmation_id: `FF-2026-${String(Math.floor(1000 + Math.random() * 9000))}`,
              eligible: true,
            },
          }),
        );
        transition(stateId, "completed", events);
        session!.status = "completed";
        session!.current = "completed";
        events.push(
          audit("workflow_completed", { to_state: "completed", details: { goal: session!.goal } }),
        );
        return { pause: "terminal" };
      }
      if (s.type === "validation") return runValidation();
      return { pause: null };
    };

    const runValidation = (): RunOutcome => {
      const uploaded = Object.values(session!.docs);
      const blocks = uploaded.filter((d) => d.validation_status === "block");
      const warnings = uploaded.filter((d) => d.validation_status === "needs_review");
      const checked = [...session!.collected].sort();

      if (blocks.length > 0) {
        session!.validation = {
          status: "block",
          confidence: 0.97,
          issues: blocks.flatMap((d) => d.issues),
          suggestions: ["Correct the problem and re-upload the document."],
          checked_documents: checked,
        };
        const state = session!.states.document_validation;
        complete(state.id);
        transition(state.id, "blocked", events);
        session!.status = "blocked";
        session!.current = "blocked";
        return { pause: "terminal" };
      }

      if (warnings.length > 0) {
        session!.validation = {
          status: "needs_review",
          confidence: 0.92,
          issues: warnings.flatMap((d) => d.issues),
          suggestions: ["Upload a corrected document", "Acknowledge the warning to continue"],
          checked_documents: checked,
        };
        const state = session!.states.document_validation;
        complete(state.id);
        transition(state.id, "review_warnings", events);
        return { pause: "approval" };
      }

      session!.validation = {
        status: "pass",
        confidence: 0.96,
        issues: [],
        suggestions: ["All cross-document checks passed."],
        checked_documents: checked,
      };
      const state = session!.states.document_validation;
      complete(state.id);
      transition(state.id, "final_approval", events);
      return run("final_approval");
    };

    const outcome = run(current.id);

    if (outcome.pause === "document_upload") {
      const docs = session.states.document_collection;
      docs.status = "active";
      session.current = docs.id;
    }
    if (outcome.pause === "approval") {
      const active = Object.values(session.states).find((s) => s.status === "active");
      session.current = active?.id ?? session.current;
    }
    if (outcome.pause === "terminal") {
      const terminal = Object.values(session.states).find(
        (s) => s.status === "active" && s.type === "terminal",
      );
      if (terminal) terminal.status = "completed";
    }

    return workflowResult(events);
  },

  async uploadDocument(_workflowId: string, file: File): Promise<DocumentUploadResult> {
    await delay(900);
    if (!session) throw new Error("no active session");
    const result = classify(file.name);

    if (result.classification && !session.collected.includes(result.classification)) {
      session.collected.push(result.classification);
    }

    const events: AuditEvent[] = [];
    events.push(audit("document_uploaded", { details: { filename: file.name } }));
    events.push(
      audit("field_extracted", {
        details: { documentId: result.document_id, classification: result.classification },
      }),
    );
    session.audit.push(...events);

    // a re-uploaded document replaces the previous one for that classification
    session.docs[result.classification ?? result.document_id] = result;
    return result;
  },

  async listAudit(): Promise<AuditResponse> {
    await delay(120);
    if (!session) return { workflow_id: "", events: [] };
    return { workflow_id: session.workflowId, events: session.audit };
  },
};

interface Rep {
  classification: string;
  fields: Record<string, string>;
  verdict?: "block" | "needs_review";
  issue?: { field: string; message: string };
}

const REPOS: Record<string, Rep> = {
  "aadhaar.pdf": { classification: "aadhaar", fields: { full_name: "S. Priya", aadhaar_number: "2345 6789 0123", date_of_birth: "18-06-2005", gender: "Female", address: "12, Gandhi Street, Fictional Town" } },
  "aadhaar_elderly.pdf": { classification: "aadhaar", fields: { full_name: "K. Subba Rao", aadhaar_number: "4567 8901 2345", date_of_birth: "15-04-1958", gender: "Male", address: "4, Temple Street, Fictional Town" } },
  "aadhaar_too_young.pdf": { classification: "aadhaar", fields: { full_name: "K. Subba Rao", aadhaar_number: "5678 9012 3456", date_of_birth: "15-04-1998", gender: "Male" }, verdict: "block", issue: { field: "date_of_birth", message: "The applicant is 28 years old; the old-age pension requires age 60 or above." } },
  "aadhaar_name_mismatch.pdf": { classification: "aadhaar", fields: { full_name: "Sita Raju", aadhaar_number: "6789 0123 4567", date_of_birth: "12-09-2004", gender: "Female" }, verdict: "block", issue: { field: "full_name", message: "Applicant name on the Aadhaar does not match the other documents." } },
  "income_certificate_valid.pdf": { classification: "income_certificate", fields: { full_name: "S. Priya", father_name: "S. Venkatesh", annual_family_income: "Rs. 1,80,000", valid_until: "31-03-2027", issued_date: "02-06-2026", certificate_number: "IC-2026-00421" } },
  "income_certificate_expired.pdf": { classification: "income_certificate", fields: { full_name: "S. Priya", annual_family_income: "Rs. 1,80,000", valid_until: "31-12-2025", issued_date: "02-06-2025", certificate_number: "IC-2024-00901" }, verdict: "block", issue: { field: "valid_until", message: "The income certificate expired on 31-12-2025. A valid certificate is required." } },
  "income_certificate_over_limit.pdf": { classification: "income_certificate", fields: { full_name: "S. Priya", annual_family_income: "Rs. 3,20,000", valid_until: "31-03-2027", certificate_number: "IC-2026-00888" }, verdict: "block", issue: { field: "annual_family_income", message: "Annual family income of Rs. 3,20,000 exceeds the Rs. 2,50,000 eligibility limit." } },
  "income_certificate_name_mismatch.pdf": { classification: "income_certificate", fields: { full_name: "Sita Raju", annual_family_income: "Rs. 1,50,000", valid_until: "31-03-2027", certificate_number: "IC-2026-00666" }, verdict: "block", issue: { field: "full_name", message: "Applicant name does not match the Aadhaar." } },
  "marks_memo.pdf": { classification: "marks_memo", fields: { full_name: "S. Priya", father_name: "S. Venkatesh", roll_number: "EN-2023-0042", examination: "B.Sc. Computer Science - VI Semester", percentage: "82% (CGPA 8.4)", result: "Pass" } },
  "bonafide_certificate.pdf": { classification: "bonafide_certificate", fields: { full_name: "S. Priya", institution: "University of Fiction", course: "B.Sc. Computer Science", year_of_study: "3rd Year", issued_date: "10-07-2026" } },
  "bank_passbook_student.pdf": { classification: "bank_passbook", fields: { full_name: "S. Priya", account_number: "9988776655443322", ifsc_code: "FICB0001234", bank_name: "National Fiction Bank" } },
  "bank_passbook.pdf": { classification: "bank_passbook", fields: { full_name: "K. Subba Rao", account_number: "1042568877914560", ifsc_code: "FICB0001234", bank_name: "National Fiction Bank", branch: "Fictional Town" } },
  "ration_card.pdf": { classification: "ration_card", fields: { ration_card_number: "RC-2021-00312", household_head_name: "K. Subba Rao", category: "BPL" } },
  "ration_card_apl.pdf": { classification: "ration_card", fields: { ration_card_number: "RC-2021-00444", household_head_name: "K. Subba Rao", category: "APL" }, verdict: "block", issue: { field: "category", message: "The ration card category is APL, not BPL as required by the pension scheme." } },
  "income_self_declaration.pdf": { classification: "income_self_declaration", fields: { full_name: "S. Priya", annual_family_income: "Rs. 1,80,000", declaration_date: "15-08-2026" } },
  "income_self_declaration_stale.pdf": { classification: "income_self_declaration", fields: { full_name: "S. Priya", annual_family_income: "Rs. 1,80,000", declaration_date: "15-03-2026" }, verdict: "needs_review", issue: { field: "declaration_date", message: "The declaration is older than 180 days. Refresh it before submission." } },
  "income_self_declaration_over_limit.pdf": { classification: "income_self_declaration", fields: { full_name: "S. Priya", annual_family_income: "Rs. 3,20,000", declaration_date: "15-08-2026" }, verdict: "block", issue: { field: "annual_family_income", message: "Annual family income of Rs. 3,20,000 exceeds the Rs. 2,50,000 eligibility limit." } },
};

function classify(filename: string): DocumentUploadResult {
  const id = `doc_${Math.floor(Math.random() * 0xffffffff).toString(16)}`;
  const repo = REPOS[filename.toLowerCase()];
  if (!repo) {
    return {
      document_id: id,
      filename,
      classification: null,
      confidence: 0.4,
      extracted_fields: {},
      issues: [],
      message: "Could not reliably classify this document.",
    };
  }
  const fields = Object.fromEntries(
    Object.entries(repo.fields).map(([k, v]) => [k, { value: v, confidence: 0.96, source_text: v }]),
  );
  const issues = repo.issue
    ? [
        {
          severity: ("error" as const),
          field: repo.issue.field,
          message: repo.issue.message,
          evidence: [repo.fields[repo.issue.field]],
          suggestion: "Upload a corrected document to continue.",
        },
      ]
    : [];
  return {
    document_id: id,
    filename,
    classification: repo.classification,
    confidence: 0.96,
    extracted_fields: fields,
    validation_status: repo.verdict ?? "pass",
    issues,
    message: repo.verdict === "block"
      ? "This document fails a hard requirement."
      : repo.verdict === "needs_review"
        ? "This document raises a warning that needs review."
        : "Document processed",
  };
}

function delay(ms = 450) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function resetMock() {
  session = null;
}