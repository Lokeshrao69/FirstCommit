import { useEffect, useRef } from "react";
import type { AuditEvent } from "@/types";
import { EVENT_META, describe } from "./eventMeta";
import { fmtConfidence, fmtFullTime, fmtTime } from "@/utils/format";

interface ExecutionTimelineProps {
  events: AuditEvent[];
  showTechnical?: boolean;
  max?: number;
  /** empty-state content when there are no visible events */
  empty?: string;
}

/** Chronological execution timeline (newest first, as the hook provides).
 *  Color from the semantic law via eventMeta; always icon+text, never color
 *  alone. Each row can expand to reveal raw detail. */
export function ExecutionTimeline({ events, showTechnical, max, empty }: ExecutionTimelineProps) {
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    // Newest on top; only auto-scroll the leading edge when a new event lands.
    const el = listRef.current;
    if (el && events.length > 0) el.scrollTop = 0;
  }, [events.length]);

  const visible = showTechnical ? events : events.filter((e) => e.event_type !== "state_activated");
  const items = max ? visible.slice(0, max) : visible;

  if (items.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-small text-faint">{empty ?? "No activity yet."}</p>
    );
  }

  return (
    <ol ref={listRef} className="slim-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Execution timeline">
      {items.map((e, i) => {
        const meta = EVENT_META[e.event_type] ?? EVENT_META.workflow_created;
        const Icon = meta.icon;
        const conf = e.confidence != null ? fmtConfidence(e.confidence) : null;
        const body = describe(e) || "—";
        return (
          <li
            key={`${e.event_type}-${e.timestamp}-${i}`}
            className="animate-fade flex gap-2.5 rounded-control px-2 py-1.5 transition-colors hover:bg-surface-2"
            style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
          >
            <div className="flex shrink-0 flex-col items-center">
              <Icon size={13} className={`mt-0.5 ${meta.tone}`} aria-hidden="true" />
              {i < items.length - 1 && <span aria-hidden="true" className="mt-1 w-px flex-1 bg-border" />}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  {meta.label}
                </span>
                {showTechnical && e.confidence != null && (
                  <span className="ff-num font-mono text-[10px] text-faint">{conf}</span>
                )}
              </div>
              <p className="truncate text-[13px] leading-tight text-text">{body}</p>
              {showTechnical && (
                <details className="group mt-0.5">
                  <summary className="cursor-pointer list-none font-mono text-[10px] text-faint hover:text-text [&::-webkit-details-marker]:hidden">
                    raw event
                  </summary>
                  <pre className="mt-1 rounded-[5px] border border-border bg-bg p-2 text-[10px] leading-relaxed text-faint">
                    {JSON.stringify(
                      { from_state: e.from_state, to_state: e.to_state, details: e.details },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              )}
              <p className="mt-0.5 font-mono text-[10px] text-faint">
                {fmtTime(e.timestamp)} <span title={fmtFullTime(e.timestamp)}>· local</span>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}