import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, ShieldCheck, X } from "lucide-react";
import type { WorkflowDetail, ValidationResult } from "@/types";
import { fmtConfidence } from "@/utils/format";

interface ApprovalModalProps {
  detail: WorkflowDetail | null;
  busy: boolean;
  onDecision: (decision: { approval?: boolean; acknowledge?: boolean }) => void;
  onClose: () => void;
}

function checklist(detail: WorkflowDetail) {
  const hasDocs = (detail.collected_documents?.length ?? 0) > 0;
  const eligibility = detail.states.find((s) => s.id === "eligibility_check");
  const validation: ValidationResult | null = detail.validation ?? null;
  return [
    { label: "Eligibility check", ok: eligibility?.status === "completed" },
    { label: "Required documents", ok: hasDocs },
    {
      label: "Cross-document validation",
      ok: validation ? validation.status !== "block" : false,
      detail: validation ? `${validation.status} · ${fmtConfidence(validation.confidence)}` : undefined,
    },
  ];
}

export function ApprovalModal({ detail, busy, onDecision, onClose }: ApprovalModalProps) {
  const isReview = detail?.current_state === "review_warnings";

  return (
    <AnimatePresence>
      {detail && detail.needs === "approval" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-ink-950/80 p-6 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className="panel w-full max-w-md p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-semibold text-paper-50">
                  {isReview ? "Acknowledge a warning" : "Approve submission?"}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-paper-100/60">
                  {isReview
                    ? "A potential eligibility issue was detected by cross-document validation."
                    : "This is the final human approval gate. Nothing is submitted without your explicit consent."}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1 text-paper-100/50 hover:bg-ink-700 hover:text-paper-50"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {checklist(detail).map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-lg border border-ink-700/60 bg-ink-900/50 px-3 py-2.5"
                >
                  <span className="text-sm text-paper-100/80">{item.label}</span>
                  {item.ok ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-ok">
                      <CheckCircle2 size={14} /> ready
                    </span>
                  ) : (
                    <span className="text-xs text-warn">{item.detail ?? "pending"}</span>
                  )}
                </div>
              ))}
            </div>

            {isReview && detail.validation?.issues.length ? (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-warn/30 bg-warn/5 px-3 py-2.5">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warn" />
                <div className="text-xs leading-relaxed text-paper-100/80">
                  {detail.validation.issues[0].message}
                  <span className="mt-1 block font-mono text-[11px] text-warn">
                    evidence: “{detail.validation.issues[0].evidence?.join(" · ")}”
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-ok/25 bg-ok/5 px-3 py-2.5">
                <ShieldCheck size={15} className="mt-0.5 shrink-0 text-ok" />
                <div className="text-xs leading-relaxed text-paper-100/80">
                  Documents verified, eligibility confirmed and validation passed with{" "}
                  {fmtConfidence(detail.validation?.confidence)} AI confidence.
                </div>
              </div>
            )}

            <div className="mt-5 flex gap-3">
              {isReview ? (
                <>
                  <button
                    type="button"
                    className="btn-ghost flex-1"
                    disabled={busy}
                    onClick={() => onDecision({ acknowledge: false })}
                  >
                    Upload corrected document
                  </button>
                  <button
                    type="button"
                    className="btn-primary flex-1"
                    disabled={busy}
                    onClick={() => onDecision({ acknowledge: true })}
                  >
                    Acknowledge and continue
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn-ghost flex-1 text-err"
                    disabled={busy}
                    onClick={() => onDecision({ approval: false })}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="btn-primary flex-1"
                    disabled={busy}
                    onClick={() => onDecision({ approval: true })}
                  >
                    Approve & submit
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}