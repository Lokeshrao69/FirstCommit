import { Check } from "lucide-react";
import type { DocumentUploadResult, WorkflowDetail } from "@/types";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
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

  const fields = new Map<string, string>();
  for (const doc of documents) {
    for (const [key, field] of Object.entries(doc.extracted_fields)) {
      fields.set(humanise(key), field.value);
    }
  }
  const summary = [...fields.entries()];

  return (
    <section>
      <h1 ref={headingRef} tabIndex={-1} className="text-title font-semibold text-text outline-none">
        Review your application
      </h1>
      <p className="mt-2 text-body text-muted">Everything we've read, in one place.</p>

      <dl className="ff-list mt-5">
        <div className="flex items-start gap-3 px-4 py-3">
          <dt className="w-36 shrink-0 text-small text-muted">Documents</dt>
          <dd className="flex flex-wrap gap-x-4 gap-y-1">
            {detail.collected_documents.length > 0 ? (
              detail.collected_documents.map((doc) => (
                <span
                  key={doc}
                  className="inline-flex items-center gap-1.5 text-body font-medium text-text"
                >
                  <Check size={14} className="text-success" aria-hidden="true" />
                  {docLabel(doc)}
                </span>
              ))
            ) : (
              <span className="text-body text-muted">None</span>
            )}
          </dd>
        </div>
        {summary.map(([label, value]) => (
          <div key={label} className="flex items-start gap-3 px-4 py-3">
            <dt className="w-36 shrink-0 text-small text-muted">{label}</dt>
            <dd className="text-body text-text">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6">
        {!validation ? (
          <InlineAlert tone="info">We couldn't read a validation result for this request.</InlineAlert>
        ) : validation.status === "pass" ? (
          <InlineAlert tone="success" title="Everything checks out.">
            <p className="text-small text-muted">
              Checked {validation.checked_documents.length || detail.collected_documents.length}{" "}
              {validation.checked_documents.length === 1 ? "document" : "documents"} with{" "}
              {fmtConfidence(validation.confidence)} confidence.
            </p>
          </InlineAlert>
        ) : validation.status === "block" ? (
          <InlineAlert tone="error" title="This application can't continue.">
            <p>
              {validation.issues[0]?.message ??
                "The details we read conflict with the requirements for this request."}
            </p>
          </InlineAlert>
        ) : (
          <InlineAlert tone="warning" title="Something needs your attention.">
            <ul className="space-y-3">
              {validation.issues.map((issue, i) => (
                <li key={`${issue.field}-${i}`}>
                  <p className="font-medium text-text">
                    {humanise(issue.field)}: {issue.message}
                  </p>
                  {issue.evidence?.map((line, j) => (
                    <p key={j} className="mt-0.5 text-small text-muted">
                      “{line}”
                    </p>
                  ))}
                  {issue.suggestion && (
                    <p className="mt-0.5 text-small">{issue.suggestion}</p>
                  )}
                </li>
              ))}
            </ul>
          </InlineAlert>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
        {validation?.status === "pass" && (
          <Button variant="primary" className="w-full sm:w-auto" onClick={onContinuePass}>
            Continue to submit
          </Button>
        )}
        {validation?.status === "needs_review" && (
          <>
            <Button
              variant="primary"
              className="order-1 w-full sm:order-2 sm:w-auto"
              disabled={busy}
              onClick={onReplace}
            >
              Replace document
            </Button>
            <Button
              variant="secondary"
              className="order-2 w-full sm:order-1 sm:w-auto"
              disabled={busy}
              onClick={onContinueAnyway}
            >
              Continue anyway
            </Button>
          </>
        )}
        {validation?.status === "block" && (
          <Button variant="secondary" className="w-full sm:w-auto" onClick={onStartOver}>
            Start over
          </Button>
        )}
      </div>
    </section>
  );
}