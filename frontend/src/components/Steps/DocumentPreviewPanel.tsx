import {
  AlertTriangle,
  FileSearch,
  FileText,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { DocumentUploadResult } from "@/types";
import { Panel, Titlebar, Tag } from "@/components/ui/Panel";
import { docLabel, humanise } from "@/utils/workflow";
import { fmtConfidence } from "@/utils/format";
import { maskSensitiveValue } from "@/utils/masking";

interface DocumentPreviewPanelProps {
  doc: DocumentUploadResult | null;
  busy: boolean;
  slotLabel: string | null;
}

const SEVERITY_STYLE = {
  error: "border-error/30 text-error",
  warning: "border-warning/30 text-warning",
  info: "border-border text-muted",
} as const;

const SEVERITY_LABEL = { error: "Blocked", warning: "Flags", info: "Note" } as const;

const VERDICT = {
  pass: {
    tag: { tone: "success" as const, label: "accepted" },
    title: "Verified and accepted",
    ring: "border-success/50 bg-success/10 text-success",
    copy: (c: number) =>
      `Classified as a verifying document at ${fmtConfidence(c)} — consistent with this request.`,
    icon: ShieldCheck,
  },
  block: {
    tag: { tone: "error" as const, label: "blocked" },
    title: "Fails a hard requirement",
    ring: "border-error/50 bg-error/10 text-error",
    copy: (c: number) =>
      `Classified at ${fmtConfidence(c)}, but it fails a requirement this run cannot bypass.`,
    icon: ShieldAlert,
  },
  needs_review: {
    tag: { tone: "warning" as const, label: "needs review" },
    title: "Raises a conflict",
    ring: "border-warning/50 bg-warning/10 text-warning",
    copy: (c: number) =>
      `Classified at ${fmtConfidence(c)} — read cleanly, but it flags a conflict for a human call.`,
    icon: AlertTriangle,
  },
} as const;

/** Inspector: extracted intelligence + verification verdict for the selected
 *  document. Sections are DOCUMENT STATUS / EXTRACTED INFORMATION /
 *  VERIFICATION & CROSS-DOCUMENT CHECKS — everything is a real read. */
export function DocumentPreviewPanel({ doc, busy, slotLabel }: DocumentPreviewPanelProps) {
  const fields = doc ? Object.entries(doc.extracted_fields ?? {}) : [];
  const issues = doc?.issues ?? [];
  const verdictKey =
    doc?.validation_status === "pass"
      ? "pass"
      : doc?.validation_status === "block"
        ? "block"
        : "needs_review";
  const verdict = doc ? VERDICT[verdictKey] : null;

  return (
    <Panel className="flex min-h-0 flex-col bg-surface">
      <Titlebar
        title="Document inspector"
        right={
          doc && (
            <Tag tone={verdict?.tag.tone}>{verdict?.tag.label}</Tag>
          )
        }
      />

      <div className="slim-scroll min-h-0 flex-1 overflow-y-auto p-4">
        {busy && (
          <div aria-live="polite" className="animate-fade">
            <div className="rounded-container border border-primary/30 bg-primary/8 p-4">
              <div className="flex items-center gap-2">
                <Loader2 size={15} className="animate-spin text-primary" aria-hidden="true" />
                <p className="text-small font-medium text-text">{slotLabel ?? "Document"} processing…</p>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {["Collect", "Classify", "Extract", "Validate"].map((s) => (
                  <div key={s} className="flex flex-col gap-1">
                    <div className="h-1 animate-pulse rounded-full bg-primary/70" />
                    <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-primary/80">
                      {s}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 font-mono text-[10px] text-muted">
                The original file is never edited; extraction is lossless.
              </p>
            </div>
          </div>
        )}

        {!busy && !doc && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-2 py-10 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-container border border-border bg-surface-2 text-muted">
              <FileSearch size={20} aria-hidden="true" />
            </span>
            {slotLabel ? (
              <>
                <p className="text-body font-semibold text-text">Not uploaded yet</p>
                <p className="max-w-[240px] text-small text-muted">
                  Upload {slotLabel} — its status, extracted information and verified fields
                  will land here.
                </p>
              </>
            ) : (
              <>
                <p className="text-body font-semibold text-text">No document selected</p>
                <p className="max-w-[240px] text-small text-muted">
                  Add a document to inspect its status, extracted information and verified fields.
                </p>
              </>
            )}
          </div>
        )}

        {!busy && doc && verdict && (
          <div className="animate-rise space-y-5">
            {/* Document status */}
            <div>
              <p className="ff-kicker-label">Document status</p>
              <div
                className={`mt-2 flex items-start gap-2.5 rounded-container border px-3 py-2.5 ${verdict.ring}`}
              >
                <verdict.icon size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-[13px] font-semibold text-text">{verdict.title}</p>
                    {doc.confidence != null && (
                      <span className="ff-num font-mono text-[11px] text-muted">
                        classification {fmtConfidence(doc.confidence)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted">
                    {doc.message || verdict.copy(doc.confidence ?? 0)}
                  </p>
                  {doc.classification && (
                    <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[10px] text-faint">
                      <FileText size={12} aria-hidden="true" />
                      {doc.filename} · {docLabel(doc.classification)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Extracted information */}
            {fields.length > 0 ? (
              <div>
                <p className="ff-kicker-label">Extracted information</p>
                <dl className="mt-2 divide-y divide-border rounded-container border border-border">
                  {fields.slice(0, 7).map(([name, field]) => (
                    <div key={name} className="px-3 py-2.5">
                      <dt className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[12px] font-semibold text-text">
                          {humanise(name)}
                        </span>
                        <span className="ff-num shrink-0 font-mono text-[10px] text-faint">
                          {fmtConfidence(field.confidence)}
                        </span>
                      </dt>
                      <dd className="mt-0.5 break-words font-mono text-[12px] text-muted">
                        {maskSensitiveValue(doc.classification, name, field.value)}
                      </dd>
                      <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-surface-3">
                        <div
                          className="h-full rounded-full bg-primary/80"
                          style={{ width: `${Math.round(Math.max(0, Math.min(1, field.confidence)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </dl>
                {fields.length > 7 && (
                  <p className="mt-1 font-mono text-[10px] text-faint">
                    +{fields.length - 7} more fields
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-container border border-border bg-surface-2 px-3 py-2.5 text-small text-muted">
                No structured fields were extracted from this file.
              </div>
            )}

            {/* Verification & cross-document checks */}
            <div>
              <p className="ff-kicker-label">
                {issues.length > 0 ? "Cross-document checks" : "Cross-document checks"}
              </p>
              {issues.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {issues.map((issue, i) => {
                    const sev = issue.severity === "error" ? "error" : issue.severity === "warning" ? "warning" : "info";
                    return (
                      <li
                        key={`${issue.field}-${i}`}
                        className={`animate-attention rounded-container border px-3 py-2.5 ${SEVERITY_STYLE[sev]}`}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="flex items-start gap-1.5 text-[12px] font-medium text-text">
                            {issue.severity === "error" ? (
                              <XCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                            ) : issue.severity === "warning" ? (
                              <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                            ) : (
                              <ShieldAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                            )}
                            {issue.message}
                          </p>
                          <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-faint">
                            {SEVERITY_LABEL[sev]}
                          </span>
                        </div>
                        {issue.field && (
                          <p className="mt-1 font-mono text-[10px] text-faint">
                            field · {humanise(issue.field)}
                          </p>
                        )}
                        {issue.evidence && issue.evidence.length > 0 && (
                          <ul className="mt-1 list-inside list-disc text-[11px] text-muted">
                            {issue.evidence.map((e, idx) => (
                              <li key={idx}>{e}</li>
                            ))}
                          </ul>
                        )}
                        {issue.suggestion && (
                          <p className="mt-1 text-[11px] text-primary">Suggestion: {issue.suggestion}</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="mt-2 flex items-start gap-2 rounded-container border border-success/30 bg-success/8 px-3 py-2.5">
                  <ShieldCheck size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-success" />
                  <p className="text-[12px] leading-relaxed text-text">
                    No cross-document conflicts detected against this request's requirements.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}