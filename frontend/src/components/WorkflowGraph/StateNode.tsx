import { memo } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { FileText, Flag, MessageSquareText, Rocket, ShieldCheck, UserCheck, Zap } from "lucide-react";
import type { StateStatus, StateType } from "@/types";
import { STATE_TYPE_LABELS } from "@/types";

export type StateNodeData = {
  label: string;
  description: string;
  type: StateType;
  status: StateStatus;
  active: boolean;
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

const STATUS_STYLES: Record<StateStatus, { ring: string; icon: string }> = {
  pending: { ring: "border-border bg-white", icon: "bg-surface text-muted" },
  active: { ring: "border-primary bg-primary/5", icon: "bg-primary text-white" },
  completed: { ring: "border-success/60 bg-success/5", icon: "bg-success text-white" },
  warning: { ring: "border-warning bg-warning-bg", icon: "bg-warning text-white" },
  blocked: { ring: "border-error bg-error-bg", icon: "bg-error text-white" },
  failed: { ring: "border-error bg-error-bg", icon: "bg-error text-white" },
};

function StateNodeComponent({ data }: NodeProps<StateNodeType>) {
  const { label, description, type, status, active } = data;
  const Icon = ICONS[type] ?? Zap;
  const s = STATUS_STYLES[status];

  return (
    <div className={`h-[104px] w-[240px] rounded-container border shadow-overlay ${s.ring}`}>
      <div className="flex h-full flex-col justify-between p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`grid h-7 w-7 place-items-center rounded-control ${s.icon}`}>
              <Icon size={15} aria-hidden="true" />
            </span>
            <span className="max-w-[130px] text-sm font-semibold leading-tight text-text">
              {label}
            </span>
          </div>
          <span className="text-small text-muted">{STATE_TYPE_LABELS[type]}</span>
        </div>
        <p
          className={`line-clamp-2 text-small leading-snug ${active ? "text-text" : "text-muted"}`}
        >
          {description}
        </p>
      </div>
    </div>
  );
}

export const StateNode = memo(StateNodeComponent);