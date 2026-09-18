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

export function WorkflowPage() {
  const { state, start, begin, advance, passReview, upload, editGoal, clear } = useWorkflow();
  const [activityOpen, setActivityOpen] = useState(false);

  const { phase, detail, plan, busy, error, confirmationId, lastGoal } = state;
  const hasWorkflow = state.workflowId !== null;
  const showStepper = phase !== "goal" && phase !== "done";

  const announce = busy
    ? "Working"
    : error
      ? `Error, ${error}`
      : "";

  return (
    <div className="flex h-full flex-col bg-bg text-text">
      <AppHeader
        busy={busy}
        hasWorkflow={hasWorkflow}
        onActivity={() => setActivityOpen(true)}
      />
      {showStepper && (
        <div className="border-b border-border">
          <Stepper phase={phase} />
        </div>
      )}

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
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