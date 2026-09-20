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

/** Compact, non-interactive progress rail. Hidden on goal/done. */
export function Stepper({ phase }: StepperProps) {
  const current = stepFor(phase);
  const index = current ? STEPS.findIndex((s) => s.key === current) : -1;

  if (index < 0) return null;

  return (
    <div className="border-b border-border bg-surface/40">
      <nav aria-label="Progress" className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <ol className="flex items-center sm:gap-4">
          {STEPS.map((step, i) => {
            const done = i < index;
            const isCurrent = i === index;
            return (
              <li
                key={step.key}
                aria-current={isCurrent ? "step" : undefined}
                className={`flex flex-1 items-center gap-2 py-3 sm:flex-none ${done || isCurrent ? "" : "opacity-40"}`}
              >
                <span
                  aria-hidden="true"
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border font-mono text-[11px] ${
                    done
                      ? "border-success/50 bg-success/10 text-success"
                      : isCurrent
                        ? "border-primary/60 bg-primary/15 text-primary"
                        : "border-border bg-surface-2 text-muted"
                  }`}
                >
                  {done ? <Check size={12} strokeWidth={2.5} /> : String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={`hidden text-[13px] font-medium sm:inline ${
                    isCurrent ? "text-text" : "text-muted"
                  }`}
                >
                  {step.label}
                </span>
                {done && <span aria-hidden="true" className="hidden h-px w-6 bg-border sm:block" />}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}