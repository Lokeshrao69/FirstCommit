import { Check } from "lucide-react";
import type { DemoPhase } from "@/hooks/useWorkflow";
import { stepFor, type StepKey } from "@/utils/workflow";

const STEPS: { key: StepKey; label: string }[] = [
  { key: "plan", label: "Plan" },
  { key: "documents", label: "Documents" },
  { key: "review", label: "Review" },
  { key: "submit", label: "Submit" },
];

interface StepperProps {
  phase: DemoPhase;
}

/** Compact, non-interactive progress indicator. Hidden on the goal and done
 *  screens; collapses to "Step 2 of 4 · Documents" under 640px. */
export function Stepper({ phase }: StepperProps) {
  const current = stepFor(phase);
  const index = current ? STEPS.findIndex((s) => s.key === current) : -1;

  if (index < 0) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      <ol className="hidden items-center gap-1 sm:flex" aria-label="Progress">
        {STEPS.map((step, i) => {
          const done = i < index;
          const isCurrent = i === index;
          return (
            <li
              key={step.key}
              aria-current={isCurrent ? "step" : undefined}
              className={`flex flex-1 items-center gap-2 py-2 ${done || isCurrent ? "" : "opacity-50"}`}
            >
              <span
                aria-hidden="true"
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold ${
                  done
                    ? "bg-success text-white"
                    : isCurrent
                      ? "bg-primary text-white"
                      : "border border-border bg-white text-muted"
                }`}
              >
                {done ? <Check size={13} /> : i + 1}
              </span>
              <span
                className={`text-sm font-medium ${
                  isCurrent ? "text-text" : done ? "text-muted" : "text-muted"
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="py-2 text-center text-small text-muted sm:hidden" aria-current="step">
        Step {index + 1} of {STEPS.length} · {STEPS[index].label}
      </p>
    </div>
  );
}