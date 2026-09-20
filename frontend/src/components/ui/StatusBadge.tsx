import type { ReactNode } from "react";
import type { BadgeTone } from "@/utils/status";

const TONES: Record<BadgeTone, { dot: string; label: string }> = {
  neutral: { dot: "bg-muted", label: "text-muted" },
  ember: { dot: "bg-primary", label: "text-primary" },
  violet: { dot: "bg-accent", label: "text-accent" },
  success: { dot: "bg-success", label: "text-success" },
  warning: { dot: "bg-warning", label: "text-warning" },
  error: { dot: "bg-error", label: "text-error" },
};

interface StatusBadgeProps {
  tone?: BadgeTone;
  label: string;
  pulse?: boolean;
  icon?: ReactNode;
}

/** Colored status badge: dot + label. Never the only signal — always pair
 *  with icon+text in the body. */
export function StatusBadge({ tone = "neutral", label, pulse, icon }: StatusBadgeProps) {
  const t = TONES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-surface px-2 py-0.5 font-mono text-[11px] font-medium tracking-wide ${t.label}`}
    >
      <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
        {pulse && (
          <span className={`absolute inline-flex h-full w-full rounded-full ${t.dot} animate-pulse-ember`} />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${t.dot}`} />
      </span>
      {icon ?? null}
      {label}
    </span>
  );
}

type VerificationStatus = "pass" | "needs_review" | "block" | string | null | undefined;

/** Compact doc-verdict chip for the pipeline rows. */
export function VerificationBadge({ status }: { status: VerificationStatus }) {
  if (status === "pass")
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-success">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-success" />
        accepted
      </span>
    );
  if (status === "needs_review")
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-warning">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-warning" />
        review
      </span>
    );
  if (status === "block")
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-error">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-error" />
        blocked
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-muted/50" />
      unchecked
    </span>
  );
}