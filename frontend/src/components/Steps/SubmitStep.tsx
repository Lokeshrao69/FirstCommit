import { useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import type { WorkflowDetail } from "@/types";
import { Button } from "@/components/ui/Button";
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

  return (
    <section>
      <h1 ref={headingRef} tabIndex={-1} className="text-title font-semibold text-text outline-none">
        Submit your application
      </h1>
      <p className="mt-2 text-body text-muted">One last look before anything is sent.</p>

      <ul className="ff-list mt-5">
        {checklist.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-3">
            <span
              aria-hidden="true"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-success text-white"
            >
              <Check size={14} />
            </span>
            <span className="font-medium text-text">{s.label}</span>
          </li>
        ))}
        {validation && (
          <li className="flex items-center gap-3 px-4 py-3">
            <span
              aria-hidden="true"
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-white ${
                validation.status === "pass" ? "bg-success" : "bg-warning"
              }`}
            >
              {validation.status === "pass" ? (
                <Check size={14} />
              ) : (
                <AlertTriangle size={14} />
              )}
            </span>
            <span className="font-medium text-text">Documents verified</span>
            <span className="ml-auto text-small text-muted">
              {fmtConfidence(validation.confidence)}
            </span>
          </li>
        )}
      </ul>

      <p className="mt-5 text-small text-muted">Nothing is sent until you click Submit.</p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          variant="primary"
          className="order-1 w-full sm:order-2 sm:w-auto"
          disabled={busy}
          onClick={onApprove}
        >
          {busy ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Submitting…
            </>
          ) : (
            "Submit application"
          )}
        </Button>
        {confirming ? (
          <div className="order-2 flex gap-2 sm:order-1">
            <Button variant="danger" onClick={onCancel}>
              Yes, cancel
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Keep editing
            </Button>
          </div>
        ) : (
          <Button
            variant="dangerText"
            className="order-2 w-full sm:order-1 sm:w-auto"
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            Cancel application
          </Button>
        )}
      </div>
    </section>
  );
}