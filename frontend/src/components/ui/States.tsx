import { type ReactNode } from "react";

/** Intentional empty state: tells the user what to do next. */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && (
        <div className="mb-1 grid h-11 w-11 place-items-center rounded-container border border-border bg-surface-2 text-muted">
          {icon}
        </div>
      )}
      <p className="text-body font-semibold text-text">{title}</p>
      <p className="max-w-sm text-small text-muted">{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Error surface: what happened, why, and the recovery. Never a raw stack. */
export function ErrorState({
  title = "Something went wrong",
  message,
  action,
  detail,
}: {
  title?: string;
  message: string;
  action?: ReactNode;
  detail?: string;
}) {
  return (
    <div
      role="alert"
      className="rounded-container border border-error/40 bg-error/10 px-4 py-4"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-body font-semibold text-error">{title}</p>
          <p className="mt-0.5 text-small text-text">{message}</p>
          {detail && (
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-faint">{detail}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}