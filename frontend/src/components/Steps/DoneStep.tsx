import { useState } from "react";
import { CheckCircle2, Copy, RotateCcw, ShieldAlert, XCircle, XOctagon, HelpCircle } from "lucide-react";
import type { WorkflowStatus } from "@/types";
import { Button } from "@/components/ui/Button";
import { useStepHeading } from "@/hooks/useStepFocus";

interface DoneStepProps {
  status: WorkflowStatus;
  confirmationId?: string;
  onRestart: () => void;
}

export function DoneStep({ status, confirmationId, onRestart }: DoneStepProps) {
  const headingRef = useStepHeading();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!confirmationId) return;
    try {
      await navigator.clipboard.writeText(confirmationId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be unavailable; nothing else to do */
    }
  };

  const success = status === "completed";
  const blocked = status === "blocked";
  const cancelled = status === "cancelled";
  const failed = status === "failed";

  const Icon = success
    ? CheckCircle2
    : blocked
      ? ShieldAlert
      : cancelled
        ? XOctagon
        : failed
          ? XCircle
          : HelpCircle;
  const iconClass = success
    ? "text-success"
    : blocked
      ? "text-error"
      : cancelled
        ? "text-muted"
        : failed
          ? "text-error"
          : "text-warning";

  const title = success
    ? "Application submitted"
    : blocked
      ? "Application blocked"
      : cancelled
        ? "Application cancelled"
        : failed
          ? "Application failed"
          : "Plan failed";

  const body = success
    ? confirmationId
      ? "We've submitted your request. Here's your confirmation ID."
      : "Submitted, but no confirmation ID was returned. Check the activity log."
    : blocked
      ? "A hard requirement isn't met, so nothing was submitted. Correct the documents and start a new request."
      : cancelled
        ? "We cancelled your application at your request. Nothing was sent."
        : failed
          ? "We couldn't complete your request. Start again or check the activity log."
          : "We couldn't create a plan for this request. Try a different description.";

  return (
    <section className="flex min-h-[60vh] flex-col items-start justify-center py-6 sm:items-center sm:text-center">
      <div className="mx-auto w-full max-w-md">
        <Icon className={`mx-auto h-11 w-11 ${iconClass}`} aria-hidden="true" />
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-4 text-title font-semibold text-text outline-none"
        >
          {title}
        </h1>
        <p className="mt-2 text-body text-muted">{body}</p>

        {success && confirmationId && (
          <div className="mt-6 flex flex-col gap-2 rounded-container border border-border bg-surface p-3 sm:items-center">
            <span className="text-small text-muted">Confirmation ID</span>
            <div className="flex w-full items-center justify-between gap-3">
              <code className="break-all text-body font-semibold text-text">
                {confirmationId}
              </code>
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0"
                onClick={() => void copy()}
              >
                <Copy size={14} aria-hidden="true" />
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <Button variant="primary" onClick={onRestart}>
            <RotateCcw size={16} aria-hidden="true" />
            Start a new request
          </Button>
        </div>
      </div>
    </section>
  );
}