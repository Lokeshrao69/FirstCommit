import { useState } from "react";
import {
  CheckCircle2,
  Copy,
  HelpCircle,
  RotateCcw,
  ShieldAlert,
  XCircle,
  XOctagon,
} from "lucide-react";
import type { WorkflowStatus } from "@/types";
import { Button } from "@/components/ui/Button";
import { useStepHeading } from "@/hooks/useStepFocus";

interface DoneStepProps {
  status: WorkflowStatus;
  confirmationId?: string;
  reason?: string;
  onRestart: () => void;
}

const TONE: Record<
  WorkflowStatus,
  { ring: string; icon: string; kicker: string; dot: string }
> = {
  completed: { ring: "border-success/40 bg-success/10", icon: "text-success", kicker: "run complete", dot: "bg-success" },
  blocked: { ring: "border-error/40 bg-error/10", icon: "text-error", kicker: "run held", dot: "bg-error" },
  cancelled: { ring: "border-muted/30 bg-surface-2", icon: "text-muted", kicker: "run cancelled", dot: "bg-muted" },
  failed: { ring: "border-error/40 bg-error/10", icon: "text-error", kicker: "run failed", dot: "bg-error" },
  generation_failed: { ring: "border-warning/40 bg-warning/10", icon: "text-warning", kicker: "plan failed", dot: "bg-warning" },
  in_progress: { ring: "border-primary/40 bg-primary/10", icon: "text-primary", kicker: "still running", dot: "bg-primary" },
};

export function DoneStep({ status, confirmationId, reason, onRestart }: DoneStepProps) {
  const headingRef = useStepHeading();
  const [copied, setCopied] = useState(false);
  const tone = TONE[status] ?? TONE.in_progress;

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

  const Icon = success
    ? CheckCircle2
    : status === "blocked"
      ? ShieldAlert
      : status === "cancelled"
        ? XOctagon
        : status === "failed"
          ? XCircle
          : HelpCircle;

  const title = success
    ? "Application submitted"
    : status === "blocked"
      ? "Application blocked"
      : status === "cancelled"
        ? "Application cancelled"
        : status === "failed"
          ? "Application failed"
          : "Plan failed";

  const body = success
    ? confirmationId
      ? "The run reached its terminal state and your request was submitted. Keep this receipt."
      : "Submitted, but no confirmation ID was returned. Check the activity log."
    : status === "blocked"
      ? "A hard requirement isn't met, so nothing was submitted. Correct the documents and start a new request."
      : status === "cancelled"
        ? "You held the run at approval. Nothing was sent."
        : status === "failed"
          ? "The engine couldn't complete the run. Start again or check the activity log."
          : "We couldn't forge a plan for this request. Try a different description.";

  return (
    <section className="flex min-h-[70vh] items-center justify-center py-10 text-center">
      <div className="mx-auto w-full max-w-md">
        <p className="ff-kicker-label">{tone.kicker}</p>
        <div className={`mx-auto mt-5 grid h-16 w-16 place-items-center rounded-full border ${tone.ring}`}>
          <Icon className={`h-7 w-7 ${tone.icon}`} aria-hidden="true" />
        </div>
        <span aria-hidden="true" className={`mx-auto mt-3 h-1 w-1 rounded-full ${tone.dot}`} />
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-4 font-display text-2xl font-semibold tracking-tight text-text outline-none"
        >
          {title}
        </h1>
        <p className="mx-auto mt-2.5 max-w-sm text-body leading-relaxed text-muted">{body}</p>

        {status === "blocked" && reason && (
          <div className="mx-auto mt-6 flex max-w-sm items-start gap-2 rounded-container border border-error/40 bg-error/8 px-3 py-2.5 text-left">
            <ShieldAlert size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-error" />
            <p className="text-[12px] leading-relaxed text-text">{reason}</p>
          </div>
        )}

        {success && confirmationId && (
          <div className="mt-7 rounded-container border border-border bg-surface p-3 text-left">
            <span className="ff-kicker-label">Confirmation receipt</span>
            <div className="mt-2 flex w-full items-center justify-between gap-3">
              <code className="ff-num break-all font-mono text-[13px] font-medium text-primary">
                {confirmationId}
              </code>
              <Button variant="secondary" size="sm" className="shrink-0" onClick={() => void copy()}>
                <Copy size={13} aria-hidden="true" />
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="mt-2 font-mono text-[10px] text-faint">
              simulated submission · nothing external was sent · full trace in Activity
            </p>
          </div>
        )}

        <div className="mt-7 flex justify-center">
          <Button variant="primary" onClick={onRestart}>
            <RotateCcw size={16} aria-hidden="true" />
            Forge a new request
          </Button>
        </div>
      </div>
    </section>
  );
}