import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Bot,
  CheckCircle2,
  FileUp,
  Flag,
  ScanText,
  ShieldAlert,
  UserCheck,
  CircleDot,
} from "lucide-react";
import type { AuditEvent, AuditEventType } from "@/types";
import { fmtConfidence, fmtTime } from "@/utils/format";

interface ChatPanelProps {
  events: AuditEvent[];
  open: boolean;
  onToggle: () => void;
}

export const EVENT_META: Record<AuditEventType, { icon: typeof Bot; label: string; tone: string }> = {
  workflow_created: { icon: CircleDot, label: "Workflow created", tone: "text-accent-soft" },
  workflow_generated: { icon: Bot, label: "Workflow planned", tone: "text-accent-soft" },
  state_activated: { icon: Bot, label: "State active", tone: "text-paper-100/60" },
  state_transition: { icon: Bot, label: "Transition", tone: "text-paper-100/60" },
  document_uploaded: { icon: FileUp, label: "Document uploaded", tone: "text-ok" },
  field_extracted: { icon: ScanText, label: "Fields extracted", tone: "text-accent-soft" },
  human_approval: { icon: UserCheck, label: "Human approval", tone: "text-warn" },
  execution: { icon: Flag, label: "Execution", tone: "text-accent" },
  workflow_completed: { icon: CheckCircle2, label: "Completed", tone: "text-ok" },
  workflow_failed: { icon: ShieldAlert, label: "Failed", tone: "text-err" },
};

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