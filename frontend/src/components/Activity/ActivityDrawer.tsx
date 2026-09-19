import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { AuditEvent, AuditEventType } from "@/types";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { describe, EVENT_META } from "./eventMeta";
import { fmtConfidence, fmtFullTime, fmtRelative } from "@/utils/format";

interface ActivityDrawerProps {
  open: boolean;
  onClose: () => void;
  events: AuditEvent[];
}

interface Group {
  type: AuditEventType;
  items: AuditEvent[];
}

export function ActivityDrawer({ open, onClose, events }: ActivityDrawerProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(open);
  const [technical, setTechnical] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const visible = technical ? events : events.filter((e) => e.event_type !== "state_activated");
  const groups: Group[] = [];
  for (const event of visible) {
    const last = groups[groups.length - 1];
    if (last !== undefined && last.type === event.event_type) last.items.push(event);
    else groups.push({ type: event.event_type, items: [event] });
  }

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Activity">
      <div className="animate-backdrop absolute inset-0 bg-text/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={trapRef}
        tabIndex={-1}
        className="animate-drawer absolute inset-y-0 right-0 flex w-full flex-col border-l border-border bg-white shadow-overlay-lg outline-none sm:w-[420px]"
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-section font-semibold text-text">Activity</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close activity"
            className="rounded-control p-1.5 text-muted transition-colors hover:bg-surface hover:text-text"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="flex items-center border-b border-border px-4 py-2">
          <button
            type="button"
            onClick={() => setTechnical((v) => !v)}
            aria-pressed={technical}
            className={`rounded-control px-2 py-1 text-small font-medium transition-colors ${
              technical ? "text-primary" : "text-muted hover:text-text"
            }`}
          >
            Show technical details
          </button>
        </div>

        <div className="slim-scroll min-h-0 flex-1 overflow-y-auto px-4 py-2">
          {groups.length === 0 ? (
            <p className="py-8 text-center text-small text-muted">No activity yet.</p>
          ) : (
            groups.map((group, gi) => {
              const meta = EVENT_META[group.type];
              const Icon = meta.icon;
              return (
                <section key={`${group.type}-${gi}`} className="border-b border-border/50 py-3 last:border-b-0">
                  <h3 className={`flex items-center gap-1.5 text-small font-semibold ${meta.tone}`}>
                    <Icon size={14} aria-hidden="true" />
                    {meta.label}
                  </h3>
                  <ul className="mt-2 space-y-1.5">
                    {group.items.map((e, ii) => (
                      <li key={ii} className="rounded-control bg-surface px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="min-w-0 truncate text-small font-medium text-text">
                            {describe(e) || "—"}
                          </p>
                          <time
                            className="shrink-0 text-small text-muted"
                            title={fmtFullTime(e.timestamp)}
                          >
                            {fmtRelative(e.timestamp)}
                          </time>
                        </div>
                        <p className="mt-0.5 text-small text-muted">
                          {group.type === "document_uploaded" && e.confidence != null
                            ? `Confidence ${fmtConfidence(e.confidence)}`
                            : "\u00A0"}
                        </p>
                        {technical && (
                          <details className="mt-1">
                            <summary className="cursor-pointer list-none text-small font-medium text-primary [&::-webkit-details-marker]:hidden">
                              Raw event
                            </summary>
                            <pre className="mt-1 rounded-control bg-white p-2 text-small leading-relaxed text-muted">
                              {JSON.stringify(
                                { from_state: e.from_state, to_state: e.to_state, details: e.details },
                                null,
                                2,
                              )}
                            </pre>
                          </details>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}