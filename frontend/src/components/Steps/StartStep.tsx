import { useState, type KeyboardEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { useStepHeading } from "@/hooks/useStepFocus";
import { GOAL_EXAMPLES } from "@/services/mock";

const IS_MAC = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);

interface StartStepProps {
  busy: boolean;
  error: string | null;
  initialGoal: string;
  onCreate: (goal: string) => void;
}

export function StartStep({ busy, error, initialGoal, onCreate }: StartStepProps) {
  const headingRef = useStepHeading();
  const [goal, setGoal] = useState(initialGoal);
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
    <section className="flex min-h-[60vh] flex-col justify-center py-6">
      <div className="mx-auto w-full max-w-xl">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-title font-semibold text-text outline-none"
        >
          What do you want to get done?
        </h1>
        <p className="mt-2 text-body text-muted">
          Describe your goal and FlowForge builds a step-by-step plan you can follow.
        </p>

        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={onKeyDown}
          rows={3}
          placeholder={`e.g. ${GOAL_EXAMPLES[0]}`}
          aria-label="Your goal"
          className="ff-field mt-5 min-h-[104px]"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-small text-muted">Examples:</span>
          {GOAL_EXAMPLES.map((label) => (
            <Button key={label} variant="tertiary" size="sm" onClick={() => setGoal(label)}>
              {label}
            </Button>
          ))}
        </div>

        {error && (
          <div className="mt-4">
            <InlineAlert tone="error">{error}</InlineAlert>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button
            variant="primary"
            className="order-1 w-full sm:order-2 sm:w-auto"
            onClick={submit}
            disabled={!canSubmit}
          >
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                Creating plan…
              </>
            ) : (
              "Create plan"
            )}
          </Button>
          <p className="order-2 text-small text-muted sm:order-1">
            Press {IS_MAC ? "⌘" : "Ctrl"}+Enter to continue
          </p>
        </div>
      </div>
    </section>
  );
}