import { AlertTriangle, CheckCircle2, FileCheck2, ShieldBan, ShieldCheck } from "lucide-react";
import type { DocumentUploadResult, WorkflowDetail } from "@/types";
import { Button } from "@/components/ui/Button";
import { Panel, Titlebar, Tag } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/Progress";
import { useStepHeading } from "@/hooks/useStepFocus";
import { docLabel, humanise } from "@/utils/workflow";
import { fmtConfidence } from "@/utils/format";

interface ReviewStepProps {
  detail: WorkflowDetail;
  documents: DocumentUploadResult[];
  busy: boolean;
  onReplace: () => void;
  onContinueAnyway: () => void;
  onContinuePass: () => void;
  onStartOver: () => void;
}

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
  const readiness = Math.round(detail.progress.ratio * 100);

  const fields = new Map<string, string>();
  for (const doc of documents) {
    for (const [key, field] of Object.entries(doc.extracted_fields)) {
      fields.set(humanise(key), field.value);
    }
  }
  const summary = [...fields.entries()];

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
            Your watch, one gate before submit
          </h1>
          <p className="mt-1.5 text-body text-muted">
            The engine checked everything it read. This is the moment where a human
            verdict decides whether the run moves forward.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tag tone="neutral">readiness {readiness}%</Tag>
          <ProgressBar value={readiness / 100} className="w-28" />
        </div>
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* What we know */}
        <div className="flex min-w-0 flex-col gap-5">
          <Panel>
            <Titlebar title="What the engine read" detail={`${detail.progress.completed}/${detail.progress.total} milestones`} />
            <dl className="divide-y divide-border">
              <div className="flex items-start gap-3 px-4 py-3">
                <dt className="w-40 shrink-0 text-small text-muted">Documents</dt>
                <dd className="flex flex-wrap gap-x-4 gap-y-1">
                  {detail.collected_documents.length > 0 ? (
                    detail.collected_documents.map((doc) => (
                      <span
                        key={doc}
                        className="inline-flex items-center gap-1.5 font-mono text-[11px] text-text"
                      >
                        <FileCheck2 size={13} className="text-success" aria-hidden="true" />
                        {docLabel(doc)}
                      </span>
                    ))
                  ) : (
                    <span className="text-small text-muted">None</span>
                  )}
                </dd>
              </div>
              {summary.map(([label, value]) => (
                <div key={label} className="flex items-start gap-3 px-4 py-3">
                  <dt className="w-40 shrink-0 text-small text-muted">{label}</dt>
                  <dd className="text-[13px] font-medium text-text">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel>
            <Titlebar title="Validation signal" detail={validation ? fmtConfidence(validation.confidence) : "—"} />
            <ul className="divide-y divide-border">
              {validation?.checked_documents.length ? (
                validation.checked_documents.map((key) => (
                  <li key={key} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-success/40 bg-success/10">
                      <CheckCircle2 size={11} className="text-success" aria-hidden="true" />
                    </span>
                    <span className="text-[13px] text-text">{docLabel(key)}</span>
                  </li>
                ))
              ) : (
                <li className="px-4 py-2.5 text-small text-muted">No documents validated yet.</li>
              )}
            </ul>
          </Panel>
        </div>

        {/* The plateau — where the human sits in the loop */}
        {validation &&
          (validation.status === "pass" ? (
            <Panel className="border-success/40 bg-success/5">
              <Titlebar title="Verdict" right={<Tag tone="success">everything checks out</Tag>} />
              <div className="p-4">
                <div className="flex items-start gap-2">
                  <ShieldCheck size={18} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
                  <p className="text-[13px] leading-relaxed text-text">
                    {validation.checked_documents.length || detail.collected_documents.length} documents
                    validated at {fmtConfidence(validation.confidence)}. No conflicts found
                    against this request's requirements.
                  </p>
                </div>
                <Button variant="primary" size="lg" className="mt-4 w-full" disabled={busy} onClick={onContinuePass}>
                  Continue to submit
                </Button>
              </div>
            </Panel>
          ) : validation.status === "block" ? (
            <Panel className="border-error/50 bg-error/5">
              <Titlebar title="Hard gate · blocked" right={<Tag tone="error">cannot proceed</Tag>} />
              <div className="flex flex-col gap-3 p-4">
                <div className="flex items-start gap-2">
                  <ShieldBan size={18} className="mt-0.5 shrink-0 text-error" aria-hidden="true" />
                  <p className="text-[13px] leading-relaxed text-text">
                    {validation.issues[0]?.message ??
                      "The details we read conflict with the requirements for this request."}
                  </p>
                </div>
                <div className="rounded-control border border-border bg-surface-2 px-3 py-2 font-mono text-[11px] text-muted">
                  {humanise(validation.issues[0]?.field ?? "unknown")} · requirement
                </div>
                <p className="text-small text-muted">
                  Nothing is submitted. Correct the document and start a new request.
                </p>
                <Button variant="secondary" className="w-full" disabled={busy} onClick={onStartOver}>
                  Start over
                </Button>
              </div>
            </Panel>
          ) : (
            <Panel className="border-warning/50 bg-warning/5">
              <Titlebar
                title="Review plateau · you decide"
                right={<Tag tone="warning">{validation.issues.length} conflict{validation.issues.length === 1 ? "" : "s"}</Tag>}
              />
              <div className="flex flex-col gap-3 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
                  <p className="text-[13px] leading-relaxed text-text">
                    The engine flags these reads, but none of them is a hard block. This is
                    your call, not a machine's.
                  </p>
                </div>
                <ul className="space-y-2">
                  {validation.issues.map((issue, i) => (
                    <li
                      key={`${issue.field}-${i}`}
                      className="rounded-control border border-border bg-surface-2 px-3 py-2.5"
                    >
                      <p className="text-[12px] font-medium text-text">
                        {humanise(issue.field)}: {issue.message}
                      </p>
                      {issue.evidence?.map((line, j) => (
                        <p key={j} className="mt-0.5 text-[11px] text-muted">
                          “{line}”
                        </p>
                      ))}
                      {issue.suggestion && (
                        <p className="mt-0.5 text-[11px] text-primary">{issue.suggestion}</p>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="mt-1 flex flex-col gap-2">
                  <Button variant="primary" className="w-full" disabled={busy} onClick={onReplace}>
                    Replace document
                  </Button>
                  <Button variant="secondary" className="w-full" disabled={busy} onClick={onContinueAnyway}>
                    Continue anyway — it's my call
                  </Button>
                </div>
              </div>
            </Panel>
          ))}
      </div>
    </section>
  );
}