import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDot,
  FileUp,
  Flag,
  ScanText,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import type { AuditEvent, AuditEventType } from "@/types";

export const EVENT_META: Record<
  AuditEventType,
  { icon: typeof Bot; label: string; tone: string }
> = {
  workflow_created: { icon: CircleDot, label: "Workflow created", tone: "text-primary" },
  workflow_generated: { icon: Bot, label: "Workflow planned", tone: "text-primary" },
  state_activated: { icon: Bot, label: "State active", tone: "text-muted" },
  state_transition: { icon: ArrowRight, label: "Transition", tone: "text-muted" },
  document_uploaded: { icon: FileUp, label: "Document uploaded", tone: "text-success" },
  field_extracted: { icon: ScanText, label: "Fields extracted", tone: "text-primary" },
  human_approval: { icon: UserCheck, label: "Human approval", tone: "text-warning" },
  execution: { icon: Flag, label: "Execution", tone: "text-primary" },
  workflow_completed: { icon: CheckCircle2, label: "Completed", tone: "text-success" },
  workflow_failed: { icon: ShieldAlert, label: "Failed", tone: "text-error" },
};

function humanState(id: string | null | undefined): string {
  if (!id) return "";
  return String(id)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** A short, human-readable summary line for an audit event. */
export function describe(event: AuditEvent): string {
  const d = event.details ?? {};
  switch (event.event_type) {
    case "document_uploaded":
      return typeof d.filename === "string" ? d.filename : "Document";
    case "workflow_created":
    case "workflow_generated":
    case "workflow_completed":
    case "workflow_failed":
      return typeof d.goal === "string" ? d.goal : "";
    case "field_extracted":
      return typeof d.classification === "string" ? humanState(d.classification) : "";
    case "human_approval":
      return d.approved === true ? "Approved" : d.approved === false ? "Rejected" : "";
    case "execution":
      return typeof d.confirmation_id === "string" ? d.confirmation_id : "";
    case "state_activated":
      return humanState(event.to_state ?? event.from_state);
    case "state_transition":
      return [humanState(event.from_state), humanState(event.to_state)].filter(Boolean).join(" → ");
    default:
      return "";
  }
}