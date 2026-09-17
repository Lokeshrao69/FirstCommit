import { memo } from "react";
import { motion } from "framer-motion";
import type { Node, NodeProps } from "@xyflow/react";
import { FileText, Flag, MessageSquareText, Rocket, ShieldCheck, UserCheck, Zap } from "lucide-react";
import type { StateStatus, StateType } from "@/types";

export type StateNodeData = {
  label: string;
  description: string;
  type: StateType;
  status: StateStatus;
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

const STATUS_STYLES: Record<StateStatus, { ring: string; badge: string; text: string }> = {
  pending: {
    ring: "border-ink-700",
    badge: "bg-ink-700 text-paper-100/70",
    text: "text-paper-100/50",
  },
  active: {
    ring: "border-accent shadow-glow",
    badge: "bg-accent text-white",
    text: "text-paper-50",
  },
  completed: {
    ring: "border-ok/50",
    badge: "bg-ok/15 text-ok",
    text: "text-paper-100/60",
  },
  warning: {
    ring: "border-warn/60",
    badge: "bg-warn/15 text-warn",
    text: "text-paper-100/70",
  },
  blocked: {
    ring: "border-err/60",
    badge: "bg-err/15 text-err",
    text: "text-paper-100/70",
  },
  failed: {
    ring: "border-err/60",
    badge: "bg-err/15 text-err",
    text: "text-paper-100/70",
  },
};

function StateNodeComponent({ data }: NodeProps<StateNodeType>) {
  const { label, description, type, status } = data;
  const Icon = ICONS[type] ?? Zap;
  const s = STATUS_STYLES[status];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`h-[104px] w-[240px] rounded-xl border bg-ink-800/90 shadow-card ${s.ring} ${
        status === "active" ? "animate-pulse-ring" : ""
      }`}
    >
      <div className="flex h-full flex-col justify-between p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`grid h-7 w-7 place-items-center rounded-md ${s.badge}`}>
              <Icon size={15} />
            </span>
            <span className={`text-sm font-semibold ${s.text}`}>{label}</span>
          </div>
          <span className="text-[10px] font-medium uppercase tracking-wider text-paper-100/40">
            {type.replace("_", " ")}
          </span>
        </div>
        <p className="line-clamp-2 text-xs leading-snug text-paper-100/60">{description}</p>
      </div>
    </motion.div>
  );
}

export const StateNode = memo(StateNodeComponent);