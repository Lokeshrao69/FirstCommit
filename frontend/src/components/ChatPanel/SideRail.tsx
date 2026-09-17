import { motion } from "framer-motion";
import type { WorkflowDetail } from "@/types";
import { fmtConfidence } from "@/utils/format";

interface SideRailProps {
  detail: WorkflowDetail | null;
}

export function SideRail({ detail }: SideRailProps) {
  if (!detail) {
    return (
      <div className="panel flex h-full flex-col gap-4 p-5">
        <span className="text-xs font-semibold uppercase tracking-widest text-paper-100/50">
          Workflow status
        </span>
        <p className="text-sm text-paper-100/60">Idle. Start with a goal to plan a workflow.</p>
      </div>
    );
  }

  const active = detail.states.find((s) => s.status === "active");
  const nextTargets = active?.transitions.map((t) => ({
    id: t.target,
    label: detail.states.find((s) => s.id === t.target)?.label ?? t.target,
  })) ?? [];

  const steps: { title: string; body: string | null }[] = [
    { title: "Goal", body: detail.goal },
    {
      title: "Workflow",
      body:
        detail.states.filter((s) => s.type !== "terminal").length > 0
          ? `${detail.states.filter((s) => s.type !== "terminal").length} active steps planned`
          : null,
    },
    {
      title: "Current action",
      body: active ? `${active.label} — waiting on you` : "Planning…",
    },
    {
      title: "Result",
      body:
        detail.last_message ??
        (detail.validation
          ? `Validation: ${detail.validation.status} · confidence ${fmtConfidence(detail.validation.confidence)}`
          : null),
    },
    {
      title: "Next state",
      body: nextTargets.map((t) => t.label).join(", ") || null,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="panel flex h-full flex-col p-5"
    >
      <span className="text-xs font-semibold uppercase tracking-widest text-paper-100/50">
        Workflow status
      </span>

      <ol className="mt-4 flex flex-1 flex-col gap-5">
        {steps.map((step, i) => (
          <li key={step.title} className="relative pl-5">
            {i < steps.length - 1 && (
              <span className="absolute left-[3px] top-4 h-full w-px bg-ink-700" />
            )}
            <span
              className={`absolute left-0 top-1.5 h-1.5 w-1.5 rounded-full ${
                i === 2 && active ? "bg-accent animate-pulse" : "bg-accent-soft/60"
              }`}
            />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-paper-100/40">
              {step.title}
            </span>
            {step.body && (
              <p className="mt-0.5 text-sm leading-snug text-paper-50">{step.body}</p>
            )}
          </li>
        ))}
      </ol>
    </motion.div>
  );
}