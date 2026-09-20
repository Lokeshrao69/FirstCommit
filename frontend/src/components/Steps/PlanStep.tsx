import { useState } from "react";
import {
  ArrowRight,
  FileText,
  Flag,
  GitBranch,
  MessageSquareText,
  Rocket,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Workflow,
  Zap,
} from "lucide-react";
import type { AuditEvent, StateType, WorkflowDefinition } from "@/types";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Panel, Titlebar, Tag } from "@/components/ui/Panel";
import { ExecutionTimeline } from "@/components/Activity/ExecutionTimeline";
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

const TYPE_TAG: Record<StateType, { label: string }> = {
  automatic: { label: "auto" },
  user_input: { label: "input" },
  document_required: { label: "docs" },
  human_approval: { label: "you" },
  validation: { label: "check" },
  execution: { label: "run" },
  terminal: { label: "end" },
};

interface PlanStepProps {
  plan: WorkflowDefinition;
  audit: AuditEvent[];
  busy: boolean;
  onStart: () => void;
  onChangeGoal: () => void;
}

export function PlanStep({ plan, audit, busy, onStart, onChangeGoal }: PlanStepProps) {
  const headingRef = useStepHeading();
  const [diagramOpen, setDiagramOpen] = useState(false);
  const steps = orderedSteps(plan.states, plan.initial_state);

  return (
    <section className="animate-rise">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-xl">
          <p className="ff-kicker-label">Plan · step 1 of 4</p>
          <h1 ref={headingRef} tabIndex={-1} className="mt-1 font-display text-[26px] font-semibold tracking-tight text-text outline-none">
            Here's your blueprint
          </h1>
          <p className="mt-1.5 text-body text-muted">
            The LLM proposed this plan. The engine will execute it — one gate at a
            time — and ask for you only where judgment is needed.
          </p>
        </div>
        <Tag tone="violet">
          <Sparkles size={11} aria-hidden="true" />
          AI planned
        </Tag>
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Execution map */}
        <Panel className="min-h-[420px] bg-surface">
          <Titlebar
            title="Execution map"
            detail={plan.workflow_id}
            right={
              <Button variant="ghost" size="sm" onClick={() => setDiagramOpen(true)}>
                <Workflow size={14} aria-hidden="true" />
                Fullscreen
              </Button>
            }
          />
          <div className="h-[calc(100%-53px)] min-h-[360px]">
            <WorkflowGraph workflow={plan} />
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-2.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Legend</span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary" /> active
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-success" /> complete
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-warning" /> needs you
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-error" /> blocked
            </span>
          </div>
        </Panel>

        {/* Right rail */}
        <div className="flex min-w-0 flex-col gap-5">
          <Panel>
            <Titlebar title="Intent" />
            <div className="px-4 py-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-primary">
                Your goal
              </p>
              <blockquote className="mt-1.5 text-body leading-relaxed text-text">
                “{plan.goal}”
              </blockquote>
              <p className="mt-3 flex items-center gap-2 text-[11px] text-faint">
                <GitBranch size={12} aria-hidden="true" />
                {plan.states.length} nodes in the forged workflow
              </p>
            </div>
          </Panel>

          <Panel>
            <Titlebar title="Blueprint" detail={`${steps.length} steps`} />
            <ol className="divide-y divide-border">
              {steps.map((step, i) => {
                const Icon = STEP_ICONS[step.type] ?? Zap;
                return (
                  <li key={step.id} className="flex items-start gap-3 px-4 py-2.5">
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="ff-num font-mono text-[11px] text-faint">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        aria-hidden="true"
                        className="grid h-7 w-7 place-items-center rounded-[5px] border border-border bg-surface-2 text-muted"
                      >
                        <Icon size={13} />
                      </span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-text">{step.label}</p>
                      <p className="line-clamp-1 text-[11px] text-faint">{step.description}</p>
                    </div>
                    <Tag tone="neutral">{TYPE_TAG[step.type].label}</Tag>
                  </li>
                );
              })}
            </ol>
          </Panel>

          <Panel>
            <Titlebar title="Trail so far" detail={`${audit.length} events`} />
            <div className="h-56">
              <ExecutionTimeline events={audit} />
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <div className="order-2 text-small text-faint sm:order-1">
          Nothing executes until you start it.
        </div>
        <div className="order-1 flex flex-col gap-3 sm:order-2 sm:flex-row">
          <Button variant="ghost" disabled={busy} onClick={onChangeGoal}>
            Change goal
          </Button>
          <Button variant="primary" size="lg" disabled={busy} onClick={onStart}>
            {busy ? "Starting…" : "Start execution"}
            {!busy && <ArrowRight size={16} aria-hidden="true" />}
          </Button>
        </div>
      </div>

      <Dialog open={diagramOpen} onClose={() => setDiagramOpen(false)} title="Execution map" wide>
        <WorkflowGraph workflow={plan} />
      </Dialog>
    </section>
  );
}