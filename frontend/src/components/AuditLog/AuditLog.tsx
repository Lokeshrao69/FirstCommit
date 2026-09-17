import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ScrollText, X } from "lucide-react";
import type { AuditEvent, AuditEventType } from "@/types";
import { fmtConfidence, fmtTime } from "@/utils/format";
import { EVENT_META } from "@/components/ChatPanel/ChatPanel";

interface AuditLogProps {
  open: boolean;
  onClose: () => void;
  events: AuditEvent[];
}

const FILTERS: ("all" | AuditEventType)[] = [
  "all",
  "workflow_created",
  "document_uploaded",
  "field_extracted",
  "human_approval",
  "execution",
  "workflow_completed",
];

export function AuditLog({ open, onClose, events }: AuditLogProps) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const listRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(
    () => (filter === "all" ? events : events.filter((e) => e.event_type === filter)),
    [events, filter],
  );

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [open, visible.length]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 flex items-stretch justify-between bg-ink-950/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <div className="flex-1" />
          <motion.aside
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className="flex w-[420px] flex-col border-l border-ink-700/60 bg-ink-900/95"
          >
            <div className="flex items-center justify-between border-b border-ink-700/60 px-5 py-4">
              <span className="flex items-center gap-2 text-sm font-semibold text-paper-50">
                <ScrollText size={16} className="text-accent-soft" />
                Audit trail
              </span>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1 text-paper-100/50 hover:bg-ink-700 hover:text-paper-50"
                aria-label="Close audit log"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 border-b border-ink-700/60 px-5 py-3">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`chip cursor-pointer ${
                    filter === f
                      ? "bg-accent text-white"
                      : "border border-ink-700 bg-ink-800 text-paper-100/60 hover:text-paper-50"
                  }`}
                >
                  {f.replace("_", " ")}
                </button>
              ))}
            </div>

            <div ref={listRef} className="slim-scroll flex-1 space-y-2 overflow-y-auto px-5 py-4">
              {visible.map((e, i) => {
                const meta = EVENT_META[e.event_type] ?? EVENT_META.workflow_generated;
                const Icon = meta.icon;
                return (
                  <motion.div
                    key={`${e.timestamp}-${i}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-ink-700/50 bg-ink-800/50 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-xs font-semibold text-paper-50">
                        <Icon size={13} className={meta.tone} />
                        {meta.label}
                      </span>
                      <span className="font-mono text-[10px] text-paper-100/40">
                        {fmtTime(e.timestamp)}
                      </span>
                    </div>
                    {e.from_state || e.to_state ? (
                      <div className="mt-1.5 font-mono text-[10px] text-paper-100/50">
                        {e.from_state ?? "•"} → {e.to_state ?? "•"}
                      </div>
                    ) : null}
                    {e.confidence !== undefined && e.confidence !== null && (
                      <div className="mt-1 font-mono text-[10px] text-accent-soft">
                        confidence {fmtConfidence(e.confidence)}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}