import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { DocumentUploadResult, WorkflowDetail } from "@/types";
import { Button } from "@/components/ui/Button";
import { DocumentRow } from "./DocumentRow";
import { useStepHeading } from "@/hooks/useStepFocus";
import { docLabel, documentState } from "@/utils/workflow";

interface DocumentsStepProps {
  detail: WorkflowDetail;
  documents: DocumentUploadResult[];
  busy: boolean;
  onUpload: (file: File) => Promise<DocumentUploadResult>;
  onContinue: () => void;
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

export function DocumentsStep({ detail, documents, busy, onUpload, onContinue }: DocumentsStepProps) {
  const headingRef = useStepHeading();
  const docState = documentState(detail.states);
  const required = docState?.required_documents ?? [];
  const collected = new Set(detail.collected_documents ?? []);
  const [rows, setRows] = useState<Record<string, { checking: boolean; problem: string | null }>>({});

  const demoEnabled =
    import.meta.env.DEV || new URLSearchParams(window.location.search).get("demo") === "1";

  const setRow = (key: string, patch: { checking?: boolean; problem?: string | null }) =>
    setRows((prev) => {
      const base = prev[key] ?? { checking: false, problem: null };
      return { ...prev, [key]: { ...base, ...patch } };
    });

  const uploadFile = async (key: string, file: File) => {
    setRow(key, { checking: true, problem: null });
    try {
      const result = await onUpload(file);
      if (result.classification && result.classification !== key) {
        setRow(key, {
          checking: false,
          problem: `This looks like a ${docLabel(result.classification)}, not a ${docLabel(key)}.`,
        });
      } else {
        setRow(key, { checking: false, problem: null });
      }
    } catch (err) {
      setRow(key, { checking: false, problem: toMessage(err) });
    }
  };

  const resultFor = (key: string): DocumentUploadResult | null => {
    for (let i = documents.length - 1; i >= 0; i -= 1) {
      if (documents[i].classification === key) return documents[i];
    }
    return null;
  };

  const uploadedCount = required.filter((key) => collected.has(key)).length;
  const allDone = required.length > 0 && uploadedCount === required.length;

  return (
    <section>
      <h1 ref={headingRef} tabIndex={-1} className="text-title font-semibold text-text outline-none">
        Upload your documents
      </h1>
      <p className="mt-2 text-body text-muted">
        {required.length} {required.length === 1 ? "document is" : "documents are"} needed. We check
        each one as you add it.
      </p>

      <ul className="ff-list mt-5">
        {required.map((key) => (
          <DocumentRow
            key={key}
            label={docLabel(key)}
            inputId={`upload-${key}`}
            checking={rows[key]?.checking ?? false}
            checked={collected.has(key)}
            problemText={rows[key]?.problem ?? null}
            apiResult={resultFor(key)}
            onFile={(file) => void uploadFile(key, file)}
          />
        ))}
      </ul>

      {demoEnabled && (
        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() =>
                void uploadFile(
                  "academic_transcript",
                  new File(["demo conflict"], "transcript.pdf", { type: "application/pdf" }),
                )
              }
            >
              Load conflicting transcript
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() =>
                void uploadFile(
                  "academic_transcript",
                  new File(["demo ok"], "transcript_corrected.pdf", { type: "application/pdf" }),
                )
              }
            >
              Load correct transcript
            </Button>
          </div>
          <p className="mt-1 text-small text-muted">Demo shortcuts (hidden in production).</p>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          variant="primary"
          className="order-1 w-full sm:order-2 sm:w-auto"
          disabled={!allDone || busy}
          onClick={onContinue}
        >
          {busy && allDone ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Continuing…
            </>
          ) : (
            "Continue"
          )}
        </Button>
        {!allDone && (
          <p className="order-2 text-small text-muted sm:order-1">
            {uploadedCount} of {required.length} uploaded
          </p>
        )}
      </div>
    </section>
  );
}