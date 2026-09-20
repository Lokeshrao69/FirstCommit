import { Loader2 } from "lucide-react";

/** Purposeful async indicator: always paired with a label by callers. */
export function Spinner({ label, mask }: { label?: string; mask?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${mask ? "pointer-events-none absolute inset-0 z-10 grid place-items-center bg-bg/60 backdrop-blur-[2px]" : ""}`}>
      <Loader2 size={16} className="animate-spin text-primary" aria-hidden="true" />
      {label && <span className="text-small text-muted">{label}</span>}
    </span>
  );
}

export function ProgressBar({
  value,
  tone = "ember",
  showLabel,
  className = "",
}: {
  value: number;
  tone?: "ember" | "success" | "warning" | "error" | "muted";
  showLabel?: boolean;
  className?: string;
}) {
  const tones: Record<string, string> = {
    ember: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    error: "bg-error",
    muted: "bg-muted",
  };
  const pct = Math.round(Math.max(0, Math.min(100, value * 100)));
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${tones[tone]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="ff-num w-8 shrink-0 text-right font-mono text-[11px] text-muted">
          {pct}%
        </span>
      )}
    </div>
  );
}