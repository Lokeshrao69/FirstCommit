/**
 * Deterministic offline mock of the FlowForge backend.
 *
 * Replicates the `DEMO_MODE` behavior of `backend/app/services/workflow_service.py`
 * for the Merit Excellence Scholarship so the frontend builds against mocks first.
 *
 * Demo rules (mirrors the backend mock provider):
 *  - `transcript.pdf`            -> semester GPA 3.20  => validation conflict (needs_review)
 *  - `transcript_corrected.pdf`  -> semester GPA 3.70  => validation passes
 *  - `government_id.pdf`         -> government_id
 *  - `income_certificate.pdf`    -> proof_of_income
 *  - `essay.pdf`                 -> personal_essay
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
  "Apply for the Merit Excellence Scholarship",
  "Submit an expense report for approval",
];

const REQUIRED_DOCS = ["academic_transcript", "government_id", "proof_of_income", "personal_essay"];
const SEMESTER_GPA_REQUIREMENT = 3.5;

interface Session {
  workflowId: string;
  goal: string;
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

function seedStates(): Record<string, WorkflowState> {
  const raw: SeedState[] = [
    {
      id: "eligibility_check",
      label: "Eligibility",
      type: "automatic",
      status: "pending",
      description: "Verifying eligibility against the applicant profile.",
      required_data: [],
      required_documents: [],
      transitions: [
        { target: "document_collection", condition: "eligibility_passed" },
        { target: "not_eligible", condition: "eligibility_failed" },
      ],
    },
    {
      id: "not_eligible",
      label: "Not Eligible",
      type: "terminal",
      description: "The applicant does not satisfy the eligibility requirements.",
      required_data: [],
      required_documents: [],
      transitions: [],
    },
    {
      id: "document_collection",
      label: "Documents",
      type: "document_required",
      description:
        "Upload your academic transcript, government ID, income certificate and personal essay.",
      required_data: [],
      required_documents: REQUIRED_DOCS,
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
        "A potential eligibility issue was detected. Acknowledge to continue, or reject to correct your documents.",
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
      description: "Human approval is required before submission. Nothing is submitted without your explicit consent.",
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

function audit(
  event_type: AuditEvent["event_type"],
  extra: Partial<AuditEvent> = {},
): AuditEvent {
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
      status: "in_progress",
      current: null,
      states: seedStates(),
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
        initial_state: "eligibility_check",
        terminal_states: ["completed", "not_eligible", "blocked", "cancelled"],
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
      // first advance: activate + auto-run the initial automatic state
      activate("eligibility_check", eventsInput(events));
      current = session.states.eligibility_check;
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
          return { pause: "document_upload" };
        }
        transition(stateId, "cancelled", events);
        session!.status = "cancelled";
        session!.current = "cancelled";
        return { pause: "terminal" };
      }
      if (s.type === "automatic") {
        // eligibility check always passes for the demo profile
        if (stateId === "eligibility_check") {
          complete(stateId);
          transition(stateId, "document_collection", events);
          return { pause: "document_upload" as const };
        }
      }
      if (s.type === "execution") {
        complete(stateId);
        events.push(
          audit("execution", {
            from_state: stateId,
            details: { confirmation_id: `FF-2026-${String(Math.floor(1000 + Math.random() * 9000))}` },
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
      const transcript = session?.docs.academic_transcript;
      const semester = transcript?.extracted_fields.current_semester_gpa;
      const conflict =
        semester && Number(String(semester.value)) < SEMESTER_GPA_REQUIREMENT;

      if (conflict) {
        session!.validation = {
          status: "needs_review",
          confidence: 0.82,
          issues: [
            {
              severity: "warning",
              field: "current_semester_gpa",
              message:
                "Current semester GPA 3.20 does not meet the requirement of 3.5.",
              evidence: ["Semester GPA: 3.20"],
              suggestion:
                "Upload a corrected transcript or acknowledge this warning to continue.",
            },
          ],
          suggestions: [
            "Upload a corrected transcript",
            "Acknowledge the warning to continue",
          ],
          checked_documents: [...session!.collected].sort(),
        };
      } else {
        session!.validation = {
          status: "pass",
          confidence: 0.93,
          issues: [],
          suggestions: ["All cross-document checks passed."],
          checked_documents: [...session!.collected].sort(),
        };
      }

      const state = session!.states.document_validation;
      complete(state.id);
      if (session!.validation.status === "needs_review") {
        transition(state.id, "review_warnings", events);
        return { pause: "approval" };
      }
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
    const name = file.name.toLowerCase();
    const result = classify(file.name);

    // re-uploading a corrected transcript replaces the conflicted academic transcript
    if (name === "transcript_corrected.pdf" && session.docs.academic_transcript) {
      delete session.docs.academic_transcript;
    }
    if (result.classification && !session.collected.includes(result.classification)) {
      session.collected.push(result.classification);
    }

    const events = [];
    events.push(audit("document_uploaded", { details: { filename: file.name } }));
    events.push(
      audit("field_extracted", {
        details: { documentId: result.document_id, classification: result.classification },
      }),
    );
    session.audit.push(...events);

    session.docs[result.classification ?? result.document_id] = result;
    return result;
  },

  async listAudit(): Promise<AuditResponse> {
    await delay(120);
    if (!session) return { workflow_id: "", events: [] };
    return { workflow_id: session.workflowId, events: session.audit };
  },
};

function eventsInput(events: AuditEvent[]): AuditEvent[] {
  return events;
}

function classify(filename: string): DocumentUploadResult {
  const id = `doc_${Math.floor(Math.random() * 0xffffffff).toString(16)}`;
  const f = (value: string, confidence: number, source_text: string) => ({
    value,
    confidence,
    source_text,
  });
  const base = (classification: string, fields: Record<string, string>) => ({
    document_id: id,
    filename,
    classification,
    confidence: 0.96,
    extracted_fields: Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, f(v, 0.96, v)]),
    ),
    issues: [],
    message: "Document processed",
  });
  const name = filename.toLowerCase();

  if (name === "transcript.pdf") {
    return {
      ...base("academic_transcript", {
        student_name: "Alex Rivera",
        cumulative_gpa: "3.72",
        current_semester_gpa: "3.20",
        enrollment_status: "Full-time",
        expected_graduation: "2027",
      }),
      validation_status: "needs_review",
      issues: [
        {
          severity: "warning",
          field: "current_semester_gpa",
          message: "Current semester GPA 3.20 does not meet the requirement of 3.5.",
          evidence: ["Semester GPA: 3.20"],
          suggestion: "Upload a corrected transcript or acknowledge this warning to continue.",
        },
      ],
    };
  }
  if (name === "transcript_corrected.pdf") {
    return {
      ...base("academic_transcript", {
        student_name: "Alex Rivera",
        cumulative_gpa: "3.72",
        current_semester_gpa: "3.70",
        enrollment_status: "Full-time",
        expected_graduation: "2027",
      }),
      validation_status: "pass",
    };
  }
  if (name === "government_id.pdf") {
    return base("government_id", {
      full_name: "Alex Rivera",
      government_id_number: "FF-ID-8841-DEMO",
      date_of_birth: "1999-04-12",
    });
  }
  if (name === "income_certificate.pdf") {
    return base("proof_of_income", {
      income_certificate_number: "INC-2026-117",
      declared_annual_income: "42,000",
      issued_date: "2026-01-15",
    });
  }
  if (name === "essay.pdf") {
    return base("personal_essay", {
      essay_submitted: "Yes",
      essay_title: "Why I deserve the Merit Excellence Scholarship",
    });
  }
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

function delay(ms = 450) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function resetMock() {
  session = null;
}