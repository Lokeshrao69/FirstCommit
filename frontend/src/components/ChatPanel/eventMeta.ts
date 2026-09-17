import { Bot, CheckCircle2, FileUp, Flag, ScanText, ShieldAlert, UserCheck, CircleDot } from "lucide-react";
import type { AuditEventType } from "@/types";

export const EVENT_META: Record<
  AuditEventType,
  { icon: typeof Bot; label: string; tone: string }
> = {
  workflow_created: { icon: CircleDot, label: "Workflow created", tone: "text-accent-soft" },
  workflow_generated: { icon: Bot, label: "Workflow planned", tone: "text-accent-soft" },
  state_activated: { icon: Bot, label: "State active", tone: "text-paper-100/60" },
  state_transition: { icon: Bot, label: "Transition", tone: "text-paper-100/60" },
  document_uploaded: { icon: FileUp, label: "Document uploaded", tone: "text-ok" },
  field_extracted: { icon: ScanText, label: "Fields extracted", tone: "text-accent-soft" },
  human_approval: { icon: UserCheck, label: "Human approval", tone: "text-warn" },
  execution: { icon: Flag, label: "Execution", tone: "text-accent" },
  workflow_completed: { icon: CheckCircle2, label: "Completed", tone: "text-ok" },
  workflow_failed: { icon: ShieldAlert, label: "Failed", tone: "text-err" },
};