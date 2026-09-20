import { memo } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { FileText, Flag, MessageSquareText, Rocket, ShieldCheck, UserCheck, Zap } from "lucide-react";
import type { StateStatus, StateType } from "@/types";
import { STATE_TYPE_LABELS } from "@/types";
import { statusToneFor } from "@/utils/status";

export type StateNodeData = {
  label: string;
  description: string;
  type: StateType;
  status: StateStatus;
  active: boolean;
  duration?: string | null;
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

/** Visual anatomy driven by the semantic law: a colored left rail carries the
 *  state, the block tint stays off until the state means something. */
const STATUS_STYLES: Record<
  StateStatus,
  { rail: string; border: string; icon: string; chip: string }
> = {
  pending: { rail: "bg-muted/30", border: "border-border", icon: "text-muted", chip: "text-muted" },
  active: { rail: "bg-primary", border: "border-primary/60 shadow-ember", icon: "bg-primary/15 text-primary", chip: "text-primary" },
  completed: { rail: "bg-success", border: "border-success/40", icon: "bg-success/12 text-success", chip: "text-success" },
  warning: { rail: "bg-warning", border: "border-warning/50", icon: "bg-warning/12 text-warning", chip: "text-warning" },
  blocked: { rail: "bg-error", border: "border-error/70", icon: "bg-error/12 text-error", chip: "text-error" },
  failed: { rail: "bg-error", border: "border-error/70", icon: "bg-error/12 text-error", chip: "text-error" },
};

const STATUS_LABEL: Record<StateStatus, string> = {
  pending: "Queued",
  active: "Active",
  completed: "Done",
  warning: "Review",
  blocked: "Blocked",
  failed: "Failed",
};

function StateNodeComponent({ data }: NodeProps<StateNodeType>) {
  const { label, description, type, status, active, duration } = data;
  const Icon = ICONS[type] ?? Zap;
  const s = STATUS_STYLES[status];
  const tone = statusToneFor(status);

  return (
    <div className={`ff-panel h-[112px] w-[248px] flex bg-surface ${s.border}`}>
      <span aria-hidden="true" className={`w-[3px] shrink-0 ${s.rail}`} />
      <div className="flex min-w-0 flex-1 flex-col px-2.5 py-2">
        <div className="flex items-center gap-2">
          <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-[5px] ${s.icon}`}>
            <Icon size={13} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 truncate font-display text-[13px] font-semibold tracking-tight text-text">
            {label}
          </span>
          <span
            className={`flex shrink-0 items-center gap-1 font-mono text-[9px] uppercase tracking-[0.1em] ${s.chip}`}
          >
            {(active && (
              <span
                aria-hidden="true"
                className="h-1 w-1 animate-pulse-ember rounded-full bg-primary"
              />
            )) || null}
            {STATUS_LABEL[status]}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-[11px] leading-[1.4] text-muted">{description}</p>
        <div
          className={`mt-auto flex items-center justify-between gap-2 border-t pt-1 ${
            status === "pending" ? "border-border/60" : "border-border"
          }`}
        >
          <span className="truncate text-[10px] text-faint">{STATE_TYPE_LABELS[type]}</span>
          <span className="ff-num shrink-0 font-mono text-[10px] text-faint">
            {duration ?? "—"}
          </span>
        </div>
        <span className="sr-only">{tone}</span>
      </div>
    </div>
  );
}

export const StateNode = memo(StateNodeComponent);