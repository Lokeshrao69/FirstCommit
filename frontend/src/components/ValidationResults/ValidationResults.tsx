import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { ValidationResult } from "@/types";
import { fmtConfidence } from "@/utils/format";

interface ValidationResultsProps {
  result: ValidationResult | null;
}

export function ValidationResults({ result }: ValidationResultsProps) {
  if (!result) return null;

  const tone =
    result.status === "pass"
      ? { text: "text-ok", bg: "bg-ok/10 border-ok/40", icon: CheckCircle2 }
      : result.status === "needs_review"
        ? { text: "text-warn", bg: "bg-warn/10 border-warn/40", icon: AlertTriangle }
        : { text: "text-err", bg: "bg-err/10 border-err/40", icon: XCircle };
  const Icon = tone.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-5 ${tone.bg}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon size={18} className={tone.text} />
          <div>
            <h3 className="text-sm font-semibold text-paper-50">
              {result.status === "pass"
                ? "Cross-document validation passed"
                : result.status === "needs_review"
                  ? "Potential eligibility issue"
                  : "Validation blocked"}
            </h3>
            <p className="mt-0.5 text-xs text-paper-100/60">
              {result.status === "pass"
                ? "Extracted fields satisfy every requirement."
                : "A critical flag needs your attention before continuing."}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="font-mono text-lg font-semibold text-paper-50">
            {fmtConfidence(result.confidence)}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-paper-100/40">
            AI confidence
          </span>
        </div>
      </div>

      {result.issues.length > 0 && (
        <div className="mt-4 space-y-2">
          {result.issues.map((issue, i) => (
            <motion.div
              key={`${issue.field}-${i}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="rounded-xl border border-ink-700/60 bg-ink-900/60 p-3"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-semibold text-warn">
                  {issue.field}
                </span>
                <span className="chip bg-warn/15 text-warn">{issue.severity}</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-paper-100/80">{issue.message}</p>
              {issue.evidence && issue.evidence.length > 0 && (
                <blockquote className="mt-2 border-l-2 border-ink-700 pl-3 font-mono text-[11px] text-paper-100/50">
                  “{issue.evidence.join(" · ")}”
                </blockquote>
              )}
              {issue.suggestion && (
                <p className="mt-1.5 text-[11px] text-paper-100/60">→ {issue.suggestion}</p>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {result.suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {result.suggestions.map((s) => (
            <span key={s} className="chip bg-ink-800 text-paper-100/60">
              {s}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}