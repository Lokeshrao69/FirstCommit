import { useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2, KeyRound, ShieldCheck } from "lucide-react";
import type { WorkflowDetail } from "@/types";
import { Button } from "@/components/ui/Button";
import { Panel, Titlebar } from "@/components/ui/Panel";
import { useStepHeading } from "@/hooks/useStepFocus";
import { findRoot, orderedSteps } from "@/utils/workflow";
import { fmtConfidence } from "@/utils/format";

interface SubmitStepProps {
  detail: WorkflowDetail;
  busy: boolean;
  onApprove: () => void;
  onCancel: () => void;
}

export function SubmitStep({ detail, busy, onApprove, onCancel }: SubmitStepProps) {
  const headingRef = useStepHeading();
  const [confirming, setConfirming] = useState(false);

  const checklist = useMemo(() => {
    const root = findRoot(detail.states);
    return orderedSteps(detail.states, root).filter(
      (s) => s.type !== "terminal" && s.id !== "final_approval" && s.status === "completed",
    );
  }, [detail]);

  const validation = detail.validation;
  const verified = validation?.status === "pass";

  return (
    <section className="animate-rise mx-auto w-full max-w-3xl">
      <header className="text-center">
        <p className="ff-kicker-label">Submit · step 4 of 4</p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-1 font-display text-[26px] font-semibold tracking-tight text-text outline-none"
        >
          Every gate passed. One gate left.
        </h1>
        <p className="mx-auto mt-1.5 max-w-md text-body text-muted">
          This is the white-key gate: the file is yours to approve. Nothing is sent
          until you command it.
        </p>
      </header>

      <div className="mt-8 grid gap-5 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel>
          <Titlebar title="Run state" />
          <ul className="divide-y divide-border">
            {checklist.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  aria-hidden="true"
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-success/40 bg-success/10"
                >
                  <Check size={11} className="text-success" strokeWidth={3} />
                </span>
                <span className="text-[13px] font-medium text-text">{s.label}</span>
              </li>
            ))}
            {validation && (
              <li className="flex items-center gap-3 px-4 py-2.5">
                <span
                  aria-hidden="true"
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                    verified
                      ? "border-success/40 bg-success/10"
                      : "border-warning/40 bg-warning/10"
                  }`}
                >
                  {verified ? (
                    <Check size={11} className="text-success" strokeWidth={3} />
                  ) : (
                    <AlertTriangle size={11} className="text-warning" />
                  )}
                </span>
                <span className="text-[13px] font-medium text-text">Documents validated</span>
                <span className="ff-num ml-auto font-mono text-[11px] text-faint">
                  {fmtConfidence(validation.confidence)}
                </span>
              </li>
            )}
          </ul>
          <div className="flex items-center gap-2 border-t border-border px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
            <ShieldCheck size={12} aria-hidden="true" />
            verified end-to-end · {detail.progress.completed}/{detail.progress.total} milestones
          </div>
        </Panel>

        {/* The white key */}
        <div className="flex flex-col">
          <Panel>
            <Titlebar title="The white key" right={!busy ? null : <Loader2 size={13} className="animate-spin text-primary" aria-hidden="true" />} />
            <div className="flex flex-col items-center gap-3 p-5">
              <span className="grid h-12 w-12 place-items-center rounded-container border border-primary/40 bg-primary/10 text-primary shadow-ember">
                <KeyRound size={20} aria-hidden="true" />
              </span>
              <p className="text-center font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                AI planned · engine validated · you hold the key
              </p>
              <p className="text-center text-small text-muted">
                Approve this run. Nothing was sent until now — the engine issues a
                confirmation receipt and the run executes.
              </p>
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                disabled={busy}
                onClick={onApprove}
              >
                {busy ? (
                  <>
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    Turning the key…
                  </>
                ) : (
                  "Submit application"
                )}
              </Button>
            </div>
          </Panel>

          <div className="mt-3">
            {confirming ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="danger" className="flex-1" onClick={onCancel}>
                  Yes, cancel
                </Button>
                <Button variant="secondary" className="flex-1" onClick={() => setConfirming(false)}>
                  Keep editing
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                className="w-full"
                disabled={busy}
                onClick={() => setConfirming(true)}
              >
                Cancel application instead
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}