import { useState } from "react";
import {
  FileText,
  Flag,
  Loader2,
  MessageSquareText,
  Rocket,
  ShieldCheck,
  UserCheck,
  Workflow,
  Zap,
} from "lucide-react";
import type { StateType, WorkflowDefinition } from "@/types";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { WorkflowGraph } from "@/components/WorkflowGraph/WorkflowGraph";
import { useStepHeading } from "@/hooks/useStepFocus";
import { orderedSteps } from "@/utils/workflow";

const STEP_ICONS: Record<StateType, typeof Zap> = {
  automatic: Zap,
  user_input: MessageSquareText,
  document_required: FileText,
  human_approval: UserCheck,
  validation: ShieldCheck,
  execution: Rocket,
  terminal: Flag,
};

interface PlanStepProps {
  plan: WorkflowDefinition;
  busy: boolean;
  onStart: () => void;
  onChangeGoal: () => void;
}

export function PlanStep({ plan, busy, onStart, onChangeGoal }: PlanStepProps) {
  const headingRef = useStepHeading();
  const [diagramOpen, setDiagramOpen] = useState(false);
  const steps = orderedSteps(plan.states, plan.initial_state);

  return (
    <section>
      <h1 ref={headingRef} tabIndex={-1} className="text-title font-semibold text-text outline-none">
        Here's your plan
      </h1>
      <p className="mt-2 text-body text-muted">“{plan.goal}”</p>

      <ol className="ff-list mt-5">
        {steps.map((step) => {
          const Icon = STEP_ICONS[step.type] ?? Zap;
          return (
            <li key={step.id} className="flex items-start gap-3 px-4 py-3">
              <span
                aria-hidden="true"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-control bg-surface text-primary"
              >
                <Icon size={16} />
              </span>
              <div className="min-w-0">
                <p className="font-medium text-text">{step.label}</p>
                <p className="text-small text-muted">{step.description}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          variant="primary"
          className="order-1 w-full sm:order-2 sm:w-auto"
          disabled={busy}
          onClick={onStart}
        >
          {busy ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Starting…
            </>
          ) : (
            "Start"
          )}
        </Button>
        <Button
          variant="secondary"
          className="order-2 w-full sm:order-1 sm:w-auto"
          onClick={onChangeGoal}
          disabled={busy}
        >
          Change goal
        </Button>
        <Button
          variant="tertiary"
          className="order-3 sm:order-1"
          onClick={() => setDiagramOpen(true)}
        >
          <Workflow size={15} aria-hidden="true" />
          View as diagram
        </Button>
      </div>

      <Dialog open={diagramOpen} onClose={() => setDiagramOpen(false)} title="Plan diagram" wide>
        <WorkflowGraph workflow={plan} />
      </Dialog>
    </section>
  );
}