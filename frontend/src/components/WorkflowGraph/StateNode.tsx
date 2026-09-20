import { memo } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import {
  AlertTriangle,
  Ban,
  Check,
  FileText,
  Flag,
  MessageSquareText,
  Rocket,
  ShieldCheck,
  UserCheck,
  Zap,
} from "lucide-react";
import type { StateStatus, StateType } from "@/types";
import { STATE_TYPE_LABELS } from "@/types";
import { statusToneFor } from "@/utils/status";

export type StateNodeData = {
  label: string;
  description: string;
  type: StateType;
  status: StateStatus;
  active: boolean;
  stageId: string;
};

export type StateNodeType = Node<StateNodeData, "stateNode">;

const ICONS: Record<StateType, typeof Zap> = {
  automatic: Zap,
  user_input: MessageSquareText,
  document_required: FileText,
  human_approval: UserCheck,
  validation: ShieldCheck,
  execution: Rocket,
  terminal: Flag,
};

/** Semantic law kept: the tinted block appears only when the state means
 *  something (active / done / review / blocked). Pending stays calm. */
const STATUS_STYLES: Record<
  StateStatus,
  { rail: string; border: string; box: string; icon: string; chip: string; chipBox: string }
> = {
  pending: {
    rail: "bg-muted/30",
    border: "border-border",
    box: "bg-surface-2",
    icon: "text-muted/60",
    chip: "text-muted/70",
    chipBox: "",
  },
  active: {
    rail: "bg-primary",
    border: "border-primary/60 shadow-ember",
    box: "bg-primary/15 text-primary",
    icon: "text-primary",
    chip: "text-primary",
    chipBox: "bg-primary/10",
  },
  completed: {
    rail: "bg-success",
    border: "border-success/40",
    box: "bg-success text-surface",
    icon: "text-surface",
    chip: "text-success",
    chipBox: "bg-success/10",
  },
  warning: {
    rail: "bg-warning",
    border: "border-warning/50",
    box: "bg-warning/15 text-warning",
    icon: "text-warning",
    chip: "text-warning",
    chipBox: "bg-warning/10",
  },
  blocked: {
    rail: "bg-error",
    border: "border-error/70",
    box: "bg-error/15 text-error",
    icon: "text-error",
    chip: "text-error",
    chipBox: "bg-error/10",
  },
  failed: {
    rail: "bg-error",
    border: "border-error/70",
    box: "bg-error/15 text-error",
    icon: "text-error",
    chip: "text-error",
    chipBox: "bg-error/10",
  },
};

const STATUS_LABEL: Record<StateStatus, string> = {
  pending: "Queued",
  active: "Active",
  completed: "Done",
  warning: "Review",
  blocked: "Blocked",
  failed: "Failed",
};

const STATUS_TINT: Partial<Record<StateStatus, string>> = {
  active: "bg-primary/[0.05]",
  completed: "bg-success/[0.05]",
  warning: "bg-warning/[0.05]",
  blocked: "bg-error/[0.06]",
  failed: "bg-error/[0.06]",
};

function StateNodeComponent({ data }: NodeProps<StateNodeType>) {
  const { label, description, type, status, active } = data;
  const Icon = ICONS[type] ?? Zap;
  const s = STATUS_STYLES[status];
  const tone = statusToneFor(status);
  const tint = STATUS_TINT[status];

  return (
    <div
      className={`ff-panel h-[132px] w-[280px] flex bg-surface ${s.border} ${tint ?? ""}`}
      aria-label={`${label} · ${STATUS_LABEL[status]}`}
    >
      <span aria-hidden="true" className={`w-[4px] shrink-0 ${s.rail}`} />
      <div className="flex min-w-0 flex-1 flex-col px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-[7px] ${s.box}`}>
            {status === "completed" ? (
              <Check size={15} strokeWidth={2.5} aria-hidden="true" />
            ) : status === "blocked" || status === "failed" ? (
              <Ban size={15} aria-hidden="true" />
            ) : status === "warning" ? (
              <AlertTriangle size={15} aria-hidden="true" />
            ) : (
              <Icon size={15} aria-hidden="true" />
            )}
          </span>
          <span className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold tracking-tight text-text">
            {label}
          </span>
          <span
            className={`flex shrink-0 items-center gap-1 rounded-[5px] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${s.chipBox} ${s.chip}`}
          >
            {active && (
              <span aria-hidden="true" className="h-1 w-1 animate-pulse-ember rounded-full bg-primary" />
            )}
            {STATUS_LABEL[status]}
          </span>
        </div>
        <p className="mt-1.5 line-clamp-2 text-[12px] leading-[1.45] text-muted">{description}</p>
        <div
          className={`mt-auto flex items-center justify-between gap-2 border-t pt-1.5 ${
            status === "pending" ? "border-border/60" : "border-border"
          }`}
        >
          <span className="truncate font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
            {STATE_TYPE_LABELS[type]}
          </span>
          <span className="ff-num shrink-0 max-w-[60%] truncate font-mono text-[10px] text-faint">
            {data.stageId}
          </span>
        </div>
        <span className="sr-only">{tone}</span>
      </div>
    </div>
  );
}

export const StateNode = memo(StateNodeComponent);