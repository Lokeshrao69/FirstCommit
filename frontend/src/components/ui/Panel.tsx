import { type HTMLAttributes, type ReactNode } from "react";

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  titlebar?: ReactNode;
  inset?: boolean;
}

/** The console's bordered plane. `inset` renders a titlebar-aware well. */
export function Panel({ children, titlebar, inset, className = "", ...rest }: PanelProps) {
  if (inset) {
    return (
      <div
        className={`ff-well ${className}`}
        {...rest}
      >
        {children}
      </div>
    );
  }
  return (
    <div className={`ff-panel ${className}`} {...rest}>
      {titlebar && <div className="ff-titlebar">{titlebar}</div>}
      {children}
    </div>
  );
}

export function Titlebar({ title, detail, right }: { title: ReactNode; detail?: ReactNode; right?: ReactNode }) {
  return (
    <div className="ff-titlebar">
      <div className="flex min-w-0 items-baseline gap-2">
        <h2 className="truncate text-small font-semibold uppercase tracking-[0.08em] text-muted">{title}</h2>
        {detail && <span className="truncate font-mono text-[11px] text-faint">{detail}</span>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

type TagTone = "neutral" | "violet" | "success" | "warning" | "error" | "ember";

const TAG_TONES: Record<TagTone, string> = {
  neutral: "border-border bg-surface text-muted",
  violet: "border-accent/30 bg-accent/10 text-accent",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  error: "border-error/30 bg-error/10 text-error",
  ember: "border-primary/30 bg-primary/10 text-primary",
};

export function Tag({ tone = "neutral", children, className = "" }: { tone?: TagTone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] font-medium ${TAG_TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}