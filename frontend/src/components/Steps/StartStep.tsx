import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight, GitBranch, ShieldCheck, Sparkle, UserRound, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { useStepHeading } from "@/hooks/useStepFocus";
import { GOAL_EXAMPLES } from "@/services/mock";

const IS_MAC = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);

/** Domain-agnostic example goals that can't run the bundled demo corpus but
 *  communicate that FlowForge is a general workflow engine. */
const GENERAL_EXAMPLES = [
  "Create an employee onboarding workflow",
  "Validate an insurance claim",
  "Prepare a compliance review",
];

/** Fake nothing: stages mirror the real generation pipeline and advance with
 *  elapsed time while the request is in flight. */
const STAGES = [
  { min: 0, label: "Understanding intent" },
  { min: 90, label: "Forging workflow plan" },
  { min: 260, label: "Validating plan" },
  { min: 520, label: "Ready to execute" },
] as const;

const ARC = [
  { icon: Sparkle, label: "Intent" },
  { icon: GitBranch, label: "Plan" },
  { icon: ShieldCheck, label: "Validate" },
  { icon: Zap, label: "Execute" },
  { icon: UserRound, label: "You" },
];

interface StartStepProps {
  busy: boolean;
  error: string | null;
  initialGoal: string;
  onCreate: (goal: string) => void;
}

function useStage(busy: boolean): number {
  const [stage, setStage] = useState(0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    if (!busy) {
      startRef.current = null;
      setStage(0);
      return;
    }
    startRef.current = performance.now();
    const id = window.setInterval(() => {
      const elapsed = performance.now() - (startRef.current ?? 0);
      let next = 0;
      for (const s of STAGES) if (elapsed >= s.min) next = s.min;
      setStage(STAGES.findIndex((s) => s.min === next));
    }, 120);
    return () => window.clearInterval(id);
  }, [busy]);
  return stage;
}

export function StartStep({ busy, error, initialGoal, onCreate }: StartStepProps) {
  const headingRef = useStepHeading();
  const [goal, setGoal] = useState(initialGoal);
  const stage = useStage(busy);
  const trimmed = goal.trim();
  const canSubmit = !busy && trimmed.length >= 3;

  const submit = () => {
    if (canSubmit) onCreate(trimmed);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && canSubmit) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <section className="flex min-h-[70vh] flex-col justify-center py-10">
      <div className="mx-auto w-full max-w-2xl">
        <p className="animate-rise font-mono text-[11px] font-medium uppercase tracking-[0.32em] text-primary">
          FlowForge
        </p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="animate-rise mt-3 font-display text-4xl font-semibold leading-[1.08] tracking-tight text-text outline-none sm:text-[44px]"
          style={{ animationDelay: "60ms" }}
        >
          From intent to execution.
        </h1>
        <p
          className="animate-rise mt-3 max-w-lg text-body leading-relaxed text-muted"
          style={{ animationDelay: "120ms" }}
        >
          The LLM plans. The state machine executes. The human stays in control.
          Describe a goal and FlowForge forges a verified, step-by-step workflow you
          can supervise from start to finish.
        </p>

        <div
          className="animate-rise mt-8"
          style={{ animationDelay: "180ms" }}
        >
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={onKeyDown}
            rows={3}
            placeholder="Apply for a scholarship and check my documents before submission…"
            aria-label="Your goal"
            className="ff-field min-h-[120px] resize-y font-display text-[19px] leading-relaxed"
          />

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
              Demo
            </span>
            {GOAL_EXAMPLES.map((label) => (
              <Button key={label} variant="secondary" size="sm" onClick={() => setGoal(label)}>
                {label}
              </Button>
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
              As a product
            </span>
            {GENERAL_EXAMPLES.map((label) => (
              <Button key={label} variant="ghost" size="sm" onClick={() => setGoal(label)}>
                {label}
              </Button>
            ))}
          </div>
        </div>

        {error && (
          <div className="animate-fade mt-4">
            <InlineAlert tone="error" title="We couldn't build that">
              <p className="text-small">{error}</p>
            </InlineAlert>
          </div>
        )}

        <div
          className="animate-rise mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          style={{ animationDelay: "240ms" }}
        >
          <div className="flex items-center gap-2.5">
            <Button
              variant="primary"
              size="lg"
              className="group order-1 w-full sm:order-2 sm:w-auto"
              onClick={submit}
              disabled={!canSubmit}
              aria-busy={busy}
            >
              {busy ? (
                <>
                  <span aria-hidden="true" className="h-2 w-2 animate-pulse-ember rounded-full bg-on-accent" />
                  {STAGES[stage]?.label}
                </>
              ) : (
                <>
                  Forge workflow
                  <ArrowRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </div>
          <p className="order-2 font-mono text-[11px] text-faint sm:order-1">
            {IS_MAC ? "⌘" : "Ctrl"}+Enter to start
          </p>
        </div>

        {/* The engine arc — the mechanism at a glance */}
        <div
          className="animate-rise mt-10 flex items-center gap-0 border-t border-border pt-5"
          style={{ animationDelay: "300ms" }}
          aria-hidden="true"
        >
          {ARC.map((step, i) => (
            <div key={step.label} className="flex flex-1 items-center gap-0">
              <div className="flex flex-col items-center gap-1.5 sm:flex-row sm:gap-2">
                <step.icon
                  size={13}
                  className={i === 3 ? "text-primary" : i === 4 ? "text-text" : "text-faint"}
                />
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.14em] ${
                    i === 3 ? "text-primary" : "text-faint"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < ARC.length - 1 && (
                <span aria-hidden="true" className="mx-2 h-px flex-1 bg-border" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}