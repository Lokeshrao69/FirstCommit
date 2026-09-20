import { useState } from "react";
import { AppHeader } from "@/components/Layout/AppHeader";
import { Stepper } from "@/components/Layout/Stepper";
import { ActivityDrawer } from "@/components/Activity/ActivityDrawer";
import { StartStep } from "@/components/Steps/StartStep";
import { PlanStep } from "@/components/Steps/PlanStep";
import { DocumentsStep } from "@/components/Steps/DocumentsStep";
import { ReviewStep } from "@/components/Steps/ReviewStep";
import { SubmitStep } from "@/components/Steps/SubmitStep";
import { DoneStep } from "@/components/Steps/DoneStep";
import { useWorkflow } from "@/hooks/useWorkflow";
import { resolveApiMode } from "@/services/api";
import { ProgressBar } from "@/components/ui/Progress";
import { NEEDS_LABELS } from "@/types";

export function WorkflowPage() {
  const { state, start, begin, advance, passReview, upload, editGoal, clear } = useWorkflow();
  const [activityOpen, setActivityOpen] = useState(false);

  const { phase, detail, plan, busy, error, confirmationId, lastGoal } = state;
  const hasWorkflow = state.workflowId !== null;
  const showStepper = phase !== "goal" && phase !== "done";
  const apiMode = resolveApiMode();

  const announce = busy
    ? "Working"
    : error
      ? `Error, ${error}`
      : "";

  const inRun = phase === "documents" || phase === "review" || phase === "submit";
  const liveOperation =
    inRun && detail?.current_state
      ? detail.states.find((s) => s.id === detail.current_state)?.label ?? null
      : null;

  const width =
    phase === "plan" || phase === "documents" || phase === "review"
      ? "max-w-[1240px]"
      : phase === "submit"
        ? "max-w-3xl"
        : phase === "done"
          ? "max-w-2xl"
          : "max-w-2xl";

  return (
    <div className="flex h-full flex-col bg-bg text-text">
      <AppHeader
        busy={busy}
        hasWorkflow={hasWorkflow}
        goal={plan?.goal ?? detail?.goal}
        workflowId={state.workflowId}
        apiMode={apiMode}
        liveOperation={liveOperation}
        liveNeeds={detail?.needs}
        onActivity={() => setActivityOpen(true)}
      />
      {showStepper && (
        <div className="border-b border-border">
          <Stepper phase={phase} />
        </div>
      )}
      {inRun && detail && (
        <div className="border-b border-border bg-surface/30">
          <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2 sm:px-6">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
              milestones
            </span>
            <ProgressBar value={detail.progress.ratio} className="w-32 sm:w-44" />
            <span className="ff-num font-mono text-[11px] text-muted">
              {detail.progress.completed}/{detail.progress.total}
            </span>
            <span className="ml-auto truncate font-mono text-[11px] text-faint">
              {detail.needs ? NEEDS_LABELS[detail.needs] : "running"}
            </span>
          </div>
        </div>
      )}

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className={`mx-auto w-full ${width} px-4 py-8 sm:px-6 sm:py-10`}>
          {phase === "goal" && (
            <StartStep
              busy={busy}
              error={error}
              initialGoal={lastGoal}
              onCreate={(goal) => void start(goal)}
            />
          )}
          {phase === "plan" && plan && (
            <PlanStep
              plan={plan}
              audit={state.audit}
              busy={busy}
              onStart={() => void begin()}
              onChangeGoal={editGoal}
            />
          )}
          {phase === "documents" && detail && (
            <DocumentsStep
              detail={detail}
              documents={state.documents}
              busy={busy}
              onUpload={upload}
              onContinue={() => void advance({})}
            />
          )}
          {phase === "review" && detail && (
            <ReviewStep
              detail={detail}
              documents={state.documents}
              busy={busy}
              onReplace={() => void advance({ acknowledge: false })}
              onContinueAnyway={() => void advance({ acknowledge: true })}
              onContinuePass={passReview}
              onStartOver={clear}
            />
          )}
          {phase === "submit" && detail && (
            <SubmitStep
              detail={detail}
              busy={busy}
              onApprove={() => void advance({ approval: true })}
              onCancel={() => void advance({ approval: false })}
            />
          )}
          {phase === "done" && (
            <DoneStep
              status={state.doneStatus ?? "cancelled"}
              confirmationId={confirmationId}
              reason={state.detail?.validation?.issues[0]?.message}
              onRestart={clear}
            />
          )}
        </div>
      </main>

      <div className="sr-only" aria-live="polite">
        {announce}
      </div>

      <ActivityDrawer
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        events={state.audit}
      />
    </div>
  );
}