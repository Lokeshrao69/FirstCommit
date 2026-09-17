import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Bot } from "lucide-react";
import type { AuditEvent } from "@/types";
import { fmtConfidence, fmtTime } from "@/utils/format";
import { EVENT_META } from "./eventMeta";

interface ChatPanelProps {
  events: AuditEvent[];
  open: boolean;
  onToggle: () => void;
}

export function ChatPanel({ events, open, onToggle }: ChatPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [events.length]);

  const visible = events.filter((e) => e.event_type !== "state_activated");

  return (
    <div className="panel flex h-full flex-col">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-paper-100/50">
          <Bot size={14} className="text-accent-soft" />
          System log
        </span>
        <span className="chip bg-ink-700 text-paper-100/70">{visible.length}</span>
      </button>

      {open && (
        <div ref={listRef} className="slim-scroll flex-1 space-y-3 overflow-y-auto px-4 pb-4">
          {visible.length === 0 && (
            <p className="pt-2 text-xs text-paper-100/40">No events yet.</p>
          )}
          {visible.map((e, i) => {
            const meta = EVENT_META[e.event_type] ?? EVENT_META.workflow_generated;
            const Icon = meta.icon;
            return (
              <motion.div
                key={`${e.timestamp}-${i}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="flex items-start gap-2.5 rounded-xl border border-ink-700/50 bg-ink-900/50 px-3 py-2"
              >
                <Icon size={14} className={`mt-0.5 shrink-0 ${meta.tone}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-paper-50">{meta.label}</span>
                    <span className="font-mono text-[10px] text-paper-100/40">
                      {fmtTime(e.timestamp)}
                    </span>
                  </div>
                  {e.confidence !== undefined && e.confidence !== null && (
                    <span className="font-mono text-[10px] text-paper-100/50">
                      confidence {fmtConfidence(e.confidence)}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}