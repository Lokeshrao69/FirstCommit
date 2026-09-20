import { AlertTriangle, ArrowRight, ShieldBan, ShieldCheck, Split, X } from "lucide-react";
import type { DocumentUploadResult, ValidationIssue, WorkflowDetail } from "@/types";
import { Button } from "@/components/ui/Button";
import { Panel, Titlebar, Tag } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/Progress";
import { useStepHeading } from "@/hooks/useStepFocus";
import { docLabel, humanise } from "@/utils/workflow";
import { fmtConfidence } from "@/utils/format";
import { maskSensitiveValue } from "@/utils/masking";

interface ReviewStepProps {
  detail: WorkflowDetail;
  documents: DocumentUploadResult[];
  busy: boolean;
  onReplace: () => void;
  onContinueAnyway: () => void;
  onContinuePass: () => void;
  onStartOver: () => void;
}

/** A concrete conflict put in front of a human: two documents disagree, or one
 *  document disagrees with a requirement. Every value is a real read. */
interface Conflict {
  field: string;
  fieldLabel: string;
  message: string;
  evidence: string[];
  left?: { label: string; value: string };
  right?: { label: string; value: string };
  kind: "document" | "requirement";
}

function conflictFor(issue: ValidationIssue, documents: DocumentUploadResult[]): Conflict | null {
  const owner = documents.find((d) =>
    d.issues.some((i) => i.field === issue.field && i.message === issue.message),
  );
  if (!owner) return null;
  const value = owner.extracted_fields[issue.field]?.value;
  if (value === undefined) return null;

  const left = {
    label: docLabel(owner.classification ?? ""),
    value: maskSensitiveValue(owner.classification, issue.field, value),
  };

  const others = documents.filter(
    (d) =>
      d !== owner &&
      d.extracted_fields[issue.field] &&
      d.extracted_fields[issue.field].value !== value,
  );

  if (others.length > 0) {
    const other = others[0];
    return {
      field: issue.field,
      fieldLabel: humanise(issue.field),
      message: issue.message,
      evidence: issue.evidence ?? [],
      left,
      right: {
        label: docLabel(other.classification ?? ""),
        value: maskSensitiveValue(other.classification, issue.field, other.extracted_fields[issue.field].value),
      },
      kind: "document",
    };
  }

  return {
    field: issue.field,
    fieldLabel: humanise(issue.field),
    message: issue.message,
    evidence: issue.evidence ?? [],
    left,
    kind: "requirement",
  };
}

function ConflictComparison({ conflict }: { conflict: Conflict }) {
  const mismatched = conflict.kind === "document";
  const heading = mismatched
    ? `${conflict.fieldLabel} Mismatch`
    : `${conflict.fieldLabel} conflict`;
  return (
    <div className="animate-fade">
      <div className="flex items-center gap-2">
        <span
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
            mismatched ? "border-primary/50 bg-primary/10 text-primary" : "border-warning/50 bg-warning/10 text-warning"
          }`}
        >
          <Split size={13} aria-hidden="true" />
        </span>
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-text">
          {heading}
        </p>
      </div>

      <div className="mt-2.5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-stretch">
        {/* Document A */}
        <div className="rounded-control border border-border bg-surface-2 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-faint">Document A</span>
            <span className="truncate font-mono text-[10px] text-muted">{conflict.left?.label}</span>
          </div>
          <p className="mt-1.5 break-words text-[13px] font-medium text-text">{conflict.left?.value}</p>
          {conflict.evidence[0] && conflict.evidence[0] !== conflict.left?.value && (
            <p className="mt-1 text-[11px] text-muted">“{conflict.evidence[0]}”</p>
          )}
        </div>

        {/* The tension */}
        <div className="flex items-center justify-center">
          <span
            className={`flex items-center gap-1 rounded-full border px-2 py-1 font-mono text-[9px] font-medium uppercase tracking-[0.14em] ${
              mismatched
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-warning/40 bg-warning/10 text-warning"
            }`}
          >
            {mismatched ? <X size={10} aria-hidden="true" /> : <AlertTriangle size={10} aria-hidden="true" />}
            ≠
          </span>
        </div>

        {/* Document B / requirement */}
        <div className="rounded-control border border-border bg-surface-2 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
              {conflict.right ? "Document B" : "Requirement"}
            </span>
            <span className="truncate font-mono text-[10px] text-muted">
              {conflict.right?.label ?? "what this run needs"}
            </span>
          </div>
          {conflict.right ? (
            <p className="mt-1.5 break-words text-[13px] font-medium text-text">{conflict.right.value}</p>
          ) : (
            <p className="mt-1.5 text-[12px] leading-relaxed text-text">{conflict.message}</p>
          )}
          {conflict.right && conflict.evidence[0] && (
            <p className="mt-1 text-[11px] text-muted">“{conflict.evidence[0]}”</p>
          )}
        </div>
      </div>

      {conflict.message && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted">{conflict.message}</p>
      )}
    </div>
  );
}

const READINESS_TAG = {
  pass: { tone: "success" as const, label: "checks passed" },
  needs_review: { tone: "warning" as const, label: "action required" },
  block: { tone: "error" as const, label: "hard block" },
};

export function ReviewStep({
  detail,
  documents,
  busy,
  onReplace,
  onContinueAnyway,
  onContinuePass,
  onStartOver,
}: ReviewStepProps) {
  const headingRef = useStepHeading();
  const validation = detail.validation ?? null;
  const readiness = validation ? Math.round(validation.confidence * 100) : 0;
  const milestonePct = Math.round(detail.progress.ratio * 100);
  const status = validation?.status ?? "pass";

  const conflicts = (validation?.issues ?? []).map((iss) => conflictFor(iss, documents)).filter((c): c is Conflict => c !== null);

  const checkedDocs = validation?.checked_documents ?? detail.collected_documents;
  const passCount = validation?.status === "pass" ? checkedDocs.length : 0;

  return (
    <section className="animate-rise">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-xl">
          <p className="ff-kicker-label">Review · step 3 of 4</p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mt-1 font-display text-[26px] font-semibold tracking-tight text-text outline-none"
          >
            The human gate before submit
          </h1>
          <p className="mt-1.5 text-body text-muted">
            The engine checked everything it read. This is where a human verdict
            decides whether the run moves forward.
          </p>
        </div>
        <StatusReadinessTone status={status} />
      </header>

      {/* Application readiness vs workflow progress — separate, real numbers */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {validation ? (
          <Panel>
            <Titlebar title="Application readiness" detail="engine confidence" />
            <div className="flex items-center gap-4 p-4">
              <div className="flex flex-col">
                <span className="ff-num font-display text-[34px] font-semibold leading-none tracking-tight text-text">
                  {readiness}%
                </span>
                <span className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
                  cross-document match
                </span>
              </div>
              <div className="flex-1">
                <ProgressBar value={readiness / 100} tone="success" />
                <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1">
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
                    documents checked
                  </span>
                  <span className="ff-num text-right font-mono text-[11px] text-text">
                    {validation.checked_documents.length}
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
                    conflicts
                  </span>
                  <span className="ff-num text-right font-mono text-[11px] text-text">
                    {validation.issues.length}
                  </span>
                </div>
              </div>
            </div>
          </Panel>
        ) : (
          <Panel>
            <Titlebar title="Application readiness" />
            <div className="p-4 text-small text-muted">Waiting for the validation signal.</div>
          </Panel>
        )}

        <Panel>
          <Titlebar title="Workflow progress" detail="execution milestones" />
          <div className="p-4">
            <div className="flex items-baseline justify-between">
              <span className="ff-num font-display text-[34px] font-semibold leading-none tracking-tight text-text">
                {milestonePct}%
              </span>
              <span className="font-mono text-[11px] text-muted">
                {detail.progress.completed}/{detail.progress.total} milestones
              </span>
            </div>
            <ProgressBar value={detail.progress.ratio} className="mt-3" />
            <ul className="mt-3.5 space-y-1.5">
              {detail.states.slice(0, 5).map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      s.status === "completed"
                        ? "bg-success"
                        : s.status === "active"
                          ? "animate-pulse-ember bg-primary"
                          : s.status === "blocked" || s.status === "failed"
                            ? "bg-error"
                            : s.status === "warning"
                              ? "bg-warning"
                              : "bg-muted/30"
                    }`}
                  />
                  <span className="truncate text-[12px] text-muted">{s.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>

      {/* The decisive zone — one place to look, one clear action */}
      <div className="mt-5">
        {!validation ? (
          <Panel>
            <Titlebar title="Sitting in the loop" />
            <div className="p-4 text-small text-muted">Nothing to decide yet.</div>
          </Panel>
        ) : status === "pass" ? (
          <Panel className="border-success/40 bg-success/5">
            <Titlebar title="Ready to submit" right={<Tag tone="success">readiness {readiness}%</Tag>} />
            <div className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-2.5 sm:flex-1">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-container border border-success/40 bg-success/10 text-success">
                  <ShieldCheck size={18} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[13px] font-medium text-text">
                    {passCount} document{passCount === 1 ? "" : "s"} verified at {fmtConfidence(validation.confidence)}.
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted">
                    No conflicts against this request's requirements. The white key is next.
                  </p>
                </div>
              </div>
              <Button variant="primary" size="lg" className="shrink-0" disabled={busy} onClick={onContinuePass}>
                Continue to submit
                <ArrowRight size={16} aria-hidden="true" />
              </Button>
            </div>
          </Panel>
        ) : status === "block" ? (
          <Panel className="border-error/50 bg-error/5">
            <Titlebar title="Action required · the run is held" right={<Tag tone="error">hard block</Tag>} />
            <div className="flex items-start gap-2.5 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-container border border-error/40 bg-error/10 text-error">
                <ShieldBan size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium leading-relaxed text-text">
                  {validation.issues[0]?.message ?? "A hard requirement isn't met."}
                </p>
                <p className="mt-1 text-[12px] text-muted">
                  Nothing is submitted and nothing is sent. Correct the document and start a new request.
                </p>
              </div>
            </div>
            {conflicts.length > 0 && (
              <div className="space-y-3 px-4 pb-4">
                {conflicts.slice(0, 1).map((c) => (
                  <ConflictComparison key={`${c.field}-${c.message}`} conflict={c} />
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2 border-t border-error/20 p-4 sm:flex-row sm:justify-end">
              <Button variant="secondary" disabled={busy} onClick={onStartOver}>
                Start a new request
              </Button>
            </div>
          </Panel>
        ) : (
          <Panel className="border-warning/50 bg-warning/5">
            <Titlebar
              title="Action required · your call"
              right={<Tag tone="warning">{validation.issues.length} conflict{validation.issues.length === 1 ? "" : "s"}</Tag>}
            />
            <div className="flex items-start gap-2.5 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-container border border-warning/40 bg-warning/10 text-warning">
                <AlertTriangle size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-text">
                  The engine flags these reads, but none is a hard block.
                </p>
                <p className="mt-1 text-[12px] text-muted">
                  This is your call, not a machine's. Replace the document to run a clean check, or
                  acknowledge the conflict and let the run proceed.
                </p>
              </div>
            </div>

            {conflicts.length > 0 && (
              <div className="space-y-4 border-t border-warning/20 px-4 py-4">
                {conflicts.map((c) => (
                  <ConflictComparison key={`${c.field}-${c.message}`} conflict={c} />
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2 border-t border-warning/20 p-4 sm:flex-row sm:justify-end">
              <Button variant="primary" className="sm:order-2" disabled={busy} onClick={onReplace}>
                Replace document
              </Button>
              <Button variant="secondary" className="sm:order-1" disabled={busy} onClick={onContinueAnyway}>
                Approve as-is — it's my call
              </Button>
            </div>
          </Panel>
        )}
      </div>
    </section>
  );
}

function StatusReadinessTone({ status }: { status: string }) {
  const tag = READINESS_TAG[status as keyof typeof READINESS_TAG] ?? READINESS_TAG.pass;
  return <Tag tone={tag.tone}>{tag.label}</Tag>;
}
