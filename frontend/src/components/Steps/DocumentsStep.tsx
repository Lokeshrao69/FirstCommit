import { useMemo, useState } from "react";
import { FolderCheck, Layers, Loader2, ShieldAlert } from "lucide-react";
import type { DocumentUploadResult, WorkflowDetail } from "@/types";
import { Button } from "@/components/ui/Button";
import { Panel, Titlebar } from "@/components/ui/Panel";
import { DocumentRow } from "./DocumentRow";
import { DocumentPreviewPanel } from "./DocumentPreviewPanel";
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

const PASSING_FILE: Record<string, string> = {
  aadhaar: "aadhaar.pdf",
  income_certificate: "income_certificate_valid.pdf",
  marks_memo: "marks_memo.pdf",
  bonafide_certificate: "bonafide_certificate.pdf",
  bank_passbook: "bank_passbook_student.pdf",
  ration_card: "ration_card.pdf",
  income_self_declaration: "income_self_declaration.pdf",
};

/** Files whose demo verdict is a hard block, keyed by the goal's service. */
function blockingVariant(goal: string): { key: string; file: string } {
  const g = goal.toLowerCase();
  if (g.includes("pension")) return { key: "aadhaar", file: "aadhaar_too_young.pdf" };
  if (g.includes("income cert") || g.includes("self declaration")) {
    return { key: "income_self_declaration", file: "income_self_declaration_over_limit.pdf" };
  }
  return { key: "income_certificate", file: "income_certificate_over_limit.pdf" };
}

/** Files whose verdict is a soft conflict — the human gets the final call. */
function reviewVariant(goal: string): { key: string; file: string } | null {
  const g = goal.toLowerCase();
  if (g.includes("income cert") || g.includes("self declaration")) {
    return { key: "income_self_declaration", file: "income_self_declaration_stale.pdf" };
  }
  return null;
}

export function DocumentsStep({ detail, documents, busy, onUpload, onContinue }: DocumentsStepProps) {
  const headingRef = useStepHeading();
  const docState = documentState(detail.states);
  const required = docState?.required_documents ?? [];
  const collected = new Set(detail.collected_documents ?? []);
  const [rows, setRows] = useState<Record<string, { checking: boolean; problem: string | null }>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(required[0] ?? null);

  const resultByKey = useMemo(() => {
    const map = new Map<string, DocumentUploadResult>();
    for (const d of documents) map.set(d.classification ?? "", d);
    return map;
  }, [documents]);

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

  const loadDemo = async () => {
    for (const key of required) {
      const file = PASSING_FILE[key];
      if (file) await uploadFile(key, new File(["demo " + key], file, { type: "application/pdf" }));
    }
  };

  const uploadedCount = required.filter((key) => collected.has(key)).length;
  const allUploaded = required.length > 0 && uploadedCount === required.length;
  const anyBlocked = documents.some((d) => d.validation_status === "block");
  // The gate only checks that every slot is sealed — a blocked document is
  // still allowed through so the run can be *held* at validation, where the
  // human sees exactly why. That's the point of the console.
  const canContinue = allUploaded && !busy;

  const selected =
    (selectedKey && resultByKey.get(selectedKey)) ||
    documents.find((d) => d.classification === selectedKey) ||
    null;

  const verifyingRow = required.find((key) => rows[key]?.checking);

  return (
    <section className="animate-rise">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-xl">
          <p className="ff-kicker-label">Documents · step 2 of 4</p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mt-1 font-display text-[26px] font-semibold tracking-tight text-text outline-none"
          >
            Your document desk
          </h1>
          <p className="mt-1.5 text-body text-muted">
            Upload each required document. The engine collect, classify and validate
            every file before it counts toward your run.
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[12px] text-faint">
          <Layers size={13} aria-hidden="true" />
          {required.length} slots · {uploadedCount} sealed
        </div>
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Panel className="min-h-[380px] bg-surface">
          <Titlebar title="Required documents" detail={`${uploadedCount}/${required.length}`} />
          <div className="p-4">
            <ul className="space-y-2.5">
              {required.map((key, i) => (
                <DocumentRow
                  key={key}
                  index={i}
                  label={docLabel(key)}
                  inputId={`upload-${key}`}
                  checking={rows[key]?.checking ?? false}
                  checked={collected.has(key)}
                  problemText={rows[key]?.problem ?? null}
                  apiResult={resultByKey.get(key) ?? null}
                  selected={selectedKey === key}
                  onSelect={() => setSelectedKey(key)}
                  onFile={(file) => void uploadFile(key, file)}
                />
              ))}
            </ul>

            {demoEnabled && (
              <div className="mt-4 border-t border-border pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" size="sm" disabled={busy} onClick={() => void loadDemo()}>
                    Load demo documents
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      const { key, file } = blockingVariant(detail.goal);
                      void uploadFile(key, new File(["demo block"], file, { type: "application/pdf" }));
                    }}
                  >
                    Load a variant that gets blocked
                  </Button>
                  {reviewVariant(detail.goal) && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        const v = reviewVariant(detail.goal);
                        if (v) void uploadFile(v.key, new File(["demo review"], v.file, { type: "application/pdf" }));
                      }}
                    >
                      Load a variant that needs a human call
                    </Button>
                  )}
                </div>
                <p className="mt-1 font-mono text-[10px] text-faint">Demo shortcuts — hidden in production.</p>
              </div>
            )}
          </div>
        </Panel>

        <DocumentPreviewPanel
          doc={selected}
          busy={verifyingRow != null}
          slotLabel={verifyingRow ? docLabel(verifyingRow) : (selectedKey && docLabel(selectedKey)) }
        />

        {/* A blocked file still passes the slot gate; the run is held until fixed. */}
        {anyBlocked && (
          <div
            className="animate-attention flex items-start gap-2 rounded-container border border-error/40 bg-error/8 px-3 py-2.5 lg:col-span-2"
            role="alert"
          >
            <ShieldAlert size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-error" />
            <p className="text-[12px] text-text">
              One document is blocked. Open its inspector, replace the file, or continue —
              the run will be held at validation until the conflict is resolved.
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex items-center gap-2 font-mono text-[11px] text-faint">
          <FolderCheck size={14} aria-hidden="true" />
          {allUploaded ? "All slots sealed" : `${uploadedCount} of ${required.length} uploaded`}
        </div>
        <Button variant="primary" size="lg" disabled={!canContinue} onClick={onContinue}>
          {busy && allUploaded ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Moving to review…
            </>
          ) : (
            "Seal documents & continue"
          )}
        </Button>
      </div>
    </section>
  );
}