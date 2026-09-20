import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  FileCheck2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import type { DocumentUploadResult } from "@/types";
import { VerificationBadge } from "@/components/ui/StatusBadge";

/** The stages a file passes through once dropped. Mirrors the pipeline. */
const STAGES = ["Collecting", "Classifying", "Extracting", "Validating"] as const;

function useStage(busy: boolean): number {
  const [stage, setStage] = useState(0);
  const start = useRef<number | null>(null);
  useEffect(() => {
    if (!busy) {
      start.current = null;
      setStage(0);
      return;
    }
    start.current = performance.now();
    const id = window.setInterval(() => {
      const elapsed = performance.now() - (start.current ?? 0);
      setStage(Math.min(STAGES.length - 1, Math.floor(elapsed / 350)));
    }, 120);
    return () => window.clearInterval(id);
  }, [busy]);
  return stage;
}

interface DocumentRowProps {
  index: number;
  label: string;
  inputId: string;
  checking: boolean;
  checked: boolean;
  problemText: string | null;
  apiResult: DocumentUploadResult | null;
  selected: boolean;
  onSelect: () => void;
  onFile: (file: File) => void;
}

export function DocumentRow({
  index,
  label,
  inputId,
  checking,
  checked,
  problemText,
  apiResult,
  selected,
  onSelect,
  onFile,
}: DocumentRowProps) {
  const stage = useStage(checking);
  const verdict = apiResult?.validation_status ?? null;

  const doneState = !checking && apiResult
    ? verdict === "block"
      ? "error"
      : verdict === "needs_review"
        ? "warning"
        : "ok"
    : checked
      ? "ok"
      : "idle";

  return (
    <li
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-pressed={selected}
      className={`group cursor-pointer rounded-container border bg-surface transition-colors ${
        selected ? "border-primary/50 shadow-ember" : "border-border hover:border-border-strong"
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="ff-num shrink-0 font-mono text-[11px] text-faint">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="grid min-w-0 flex-1 items-center gap-0.5">
          <span className="truncate text-[13px] font-semibold text-text">{label}</span>
          <span className="text-[11px] text-faint">
            {checked
              ? "collected and verified"
              : checking
                ? "processing…"
                : "required — upload a file"}
          </span>
        </span>

        {checking ? (
          <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-primary">
            <CircleDashed size={11} className="animate-spin" aria-hidden="true" />
            {STAGES[stage]}
          </span>
        ) : (
          <span aria-hidden="true" className="flex shrink-0 items-center gap-1">
            {doneState === "ok" && <CheckCircle2 size={16} className="text-success" />}
            {doneState === "warning" && <AlertTriangle size={16} className="text-warning" />}
            {doneState === "error" && <XCircle size={16} className="text-error" />}
            {doneState === "idle" && <FileCheck2 size={16} className="text-muted/50" />}
          </span>
        )}

        <label
          htmlFor={inputId}
          className={`shrink-0 rounded-control border font-mono text-[11px] font-medium transition-colors ${
            checking
              ? "pointer-events-none border-border text-faint"
              : doneState === "error"
                ? "border-error/40 text-error hover:bg-error/10"
                : "border-border-strong text-muted hover:border-primary/50 hover:text-primary"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="flex items-center gap-1 px-2.5 py-1.5">
            <UploadCloud size={12} aria-hidden="true" />
            {checked || apiResult ? (doneState === "error" ? "Replace" : "Update") : "Add"}
          </span>
        </label>
        <input
          id={inputId}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {checking && (
        <div className="px-4 pb-3" aria-live="polite">
          <div className="flex items-center gap-1.5">
            {STAGES.map((s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= stage ? "bg-primary" : "bg-surface-3"
                }`}
              />
            ))}
          </div>
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-primary">
            {STAGES[stage]}… <span className="text-faint">keeping original safe</span>
          </p>
        </div>
      )}

      {!checking && apiResult && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-4 py-2">
          {apiResult.classification && (
            <span className="font-mono text-[11px] text-faint">
              {apiResult.filename}
            </span>
          )}
          {apiResult.confidence != null && (
            <span className="ff-num font-mono text-[11px] text-faint">
              match {Math.round(apiResult.confidence * 100)}%
            </span>
          )}
          <VerificationBadge status={verdict} />
          {problemText && (
            <span className="text-[11px] text-error" role="alert">
              {problemText}
            </span>
          )}
        </div>
      )}
    </li>
  );
}