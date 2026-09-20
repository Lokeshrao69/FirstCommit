import { FileText, Flag, MessageSquareText, Rocket, ShieldCheck, UserCheck, Zap } from "lucide-react";
import type { StateStatus, StateType, WorkflowDefinition, WorkflowDetail } from "@/types";
import { STATE_TYPE_LABELS } from "@/types";
import { layout } from "@/utils/layout";
import { findRoot } from "@/utils/workflow";

const ICONS: Record<StateType, typeof Zap> = {
  automatic: Zap,
  user_input: MessageSquareText,
  document_required: FileText,
  human_approval: UserCheck,
  validation: ShieldCheck,
  execution: Rocket,
  terminal: Flag,
};

const STATUS_LABEL: Record<StateStatus, string> = {
  pending: "Queued",
  active: "Active",
  completed: "Done",
  warning: "Review",
  blocked: "Blocked",
  failed: "Failed",
};

const STATUS_DOT: Record<StateStatus, string> = {
  pending: "bg-muted/40",
  active: "bg-primary",
  completed: "bg-success",
  warning: "bg-warning",
  blocked: "bg-error",
  failed: "bg-error",
};

/**
 * Vertical execution timeline — the graph gone linear. Shown on small
 * screens where a horizontal auto-layout graph cannot be read at a glance;
 * the same states, the same semantics, driven by the same data.
 */
export function MobileTimeline({
  workflow,
}: {
  workflow: WorkflowDefinition | WorkflowDetail | null;
}) {
  const states = workflow?.states ?? [];
  const isDefinition = !!workflow && "initial_state" in workflow;
  const root = !!workflow && isDefinition && workflow.initial_state
    ? workflow.initial_state
    : findRoot(states);
  const activeId = !!workflow && "current_state" in workflow ? workflow.current_state : null;

  const ordered = layout(states, root || states[0]?.id || "")
    .map((p) => states.find((s) => s.id === p.id))
    .filter((s): s is typeof states[number] => !!s);

  return (
    <ol className="slim-scroll h-full overflow-y-auto py-2 pr-1" aria-label="Execution timeline">
      {ordered.map((s, i) => {
        const Icon = ICONS[s.type] ?? Zap;
        const status: StateStatus = isDefinition ? "pending" : s.status;
        const active = s.id === activeId;
        const last = i === ordered.length - 1;
        return (
          <li key={s.id} className="relative flex gap-3 pb-4 last:pb-0" aria-current={active ? "step" : undefined}>
            {!last && (
              <span aria-hidden="true" className="absolute left-[15px] top-8 h-[calc(100%-20px)] w-px bg-border" />
            )}
            <span
              className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-surface-2 ${
                active ? "shadow-ember border-primary/60" : ""
              }`}
            >
              <Icon
                size={14}
                aria-hidden="true"
                className={
                  active
                    ? "text-primary"
                    : status === "completed"
                      ? "text-success"
                      : status === "warning"
                        ? "text-warning"
                        : status === "blocked" || status === "failed"
                          ? "text-error"
                          : "text-muted"
                }
              />
              <span
                aria-hidden="true"
                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface ${STATUS_DOT[status]}`}
              />
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-display text-[15px] font-semibold tracking-tight text-text">
                  {s.label}
                </p>
                <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                  {STATUS_LABEL[status]}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-muted">{s.description}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
                  {STATE_TYPE_LABELS[s.type]}
                </span>
                <span className="ff-num shrink-0 max-w-[60%] truncate font-mono text-[10px] text-faint">
                  {s.id}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}