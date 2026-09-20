import { useEffect, useState } from "react";
import { ScrollText, X } from "lucide-react";
import type { AuditEvent } from "@/types";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { ExecutionTimeline } from "./ExecutionTimeline";
import { EmptyState } from "@/components/ui/States";

interface ActivityDrawerProps {
  open: boolean;
  onClose: () => void;
  events: AuditEvent[];
}

/** Full audit trail drawer. Traps focus, Esc closes, focus restored on close. */
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

  const hasNonSystem = events.some((e) => e.event_type !== "state_activated");

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Activity trail">
      <div className="animate-backdrop absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        ref={trapRef}
        tabIndex={-1}
        className="animate-drawer absolute inset-y-0 right-0 flex w-full flex-col border-l border-border-strong bg-surface shadow-overlay-lg outline-none sm:w-[440px]"
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <ScrollText size={16} className="text-primary" aria-hidden="true" />
            <h2 className="font-display text-[15px] font-semibold tracking-tight text-text">
              Audit trail
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close activity"
            className="rounded-control p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
            {events.length} events
          </span>
          <button
            type="button"
            onClick={() => setTechnical((v) => !v)}
            aria-pressed={technical}
            className={`rounded-control px-2 py-1 font-mono text-[10px] font-medium transition-colors ${
              technical ? "bg-accent/10 text-accent" : "text-faint hover:text-text"
            }`}
          >
            {technical ? "technical view" : "plain view"}
          </button>
        </div>

        {!hasNonSystem ? (
          <EmptyState
            icon={<ScrollText size={20} aria-hidden="true" />}
            title="No activity yet"
            body="Every step the workflow takes is recorded here — planning, uploads, validation and approvals."
          />
        ) : (
          <ExecutionTimeline events={events} showTechnical={technical} />
        )}
      </div>
    </div>
  );
}