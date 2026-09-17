import { useState } from "react";
import { motion } from "framer-motion";
import { Layers, Loader2, PartyPopper, RotateCcw, ScrollText } from "lucide-react";
import { ApprovalModal } from "@/components/ApprovalModal/ApprovalModal";
import { AuditLog } from "@/components/AuditLog/AuditLog";
import { ChatPanel } from "@/components/ChatPanel/ChatPanel";
import { SideRail } from "@/components/ChatPanel/SideRail";
import { DocumentUpload } from "@/components/DocumentUpload/DocumentUpload";
import { DocumentDetails } from "@/components/DocumentDetails/DocumentDetails";
import { GoalInput } from "@/components/GoalInput/GoalInput";
import { ProgressBar } from "@/components/ProgressBar/ProgressBar";
import { ValidationResults } from "@/components/ValidationResults/ValidationResults";
import { WorkflowGraph } from "@/components/WorkflowGraph/WorkflowGraph";
import { useWorkflow } from "@/hooks/useWorkflow";
import type { WorkflowStatus } from "@/types";

export function Demo() {
  const { state, start, advance, upload, clear } = useWorkflow();
  const { phase, detail, documents, audit, busy, error, workflowId } = state;
  const [auditOpen, setAuditOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);

  const handleDecision = (decision: { approval?: boolean; acknowledge?: boolean }) => {
    void advance(decision);
  };

  return (
    <div className="flex h-full flex-col">
      <Header
        status={detail?.status ?? null}
        busy={busy}
        onAudit={() => setAuditOpen(true)}
      />

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-72 shrink-0 flex-col gap-4 overflow-y-hidden border-r border-ink-700/60 p-4">
          <div className="min-h-0 flex-1">
            <SideRail detail={detail} />
          </div>
          <ChatPanel events={audit} open={chatOpen} onToggle={() => setChatOpen((o) => !o)} />
        </aside>

        <main className="relative min-w-0 flex-1">
          {phase === "goal" ? (
            <div className="h-full overflow-y-auto p-6">
              <div className="mx-auto grid max-w-5xl place-items-center pt-[12vh]">
                <GoalInput busy={busy} onStart={(g) => void start(g)} />
              </div>
            </div>
          ) : (
            <div className="h-full">
              <WorkflowGraph detail={detail} />
            </div>
          )}
        </main>

        <aside className="slim-scroll flex w-[380px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-ink-700/60 p-4">
          {error && (
            <div className="rounded-xl border border-err/40 bg-err/10 p-3 text-xs leading-relaxed text-paper-100/80">
              {error}
            </div>
          )}

          {phase === "documents" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <DocumentUpload
                detail={detail}
                busy={busy}
                onUpload={async (file) => {
                  await upload(file);
                }}
                onContinue={() => void advance({})}
              />
              <DocumentDetails documents={documents} />
            </motion.div>
          )}

          {(phase === "review" || phase === "approval") && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <ValidationResults result={detail?.validation ?? null} />
              <p className="text-xs leading-relaxed text-paper-100/60">
                The plan is ready to proceed. Confirm in the dialog — or reject to stop the workflow.
              </p>
            </motion.div>
          )}

          {phase === "done" && (
            <SubmissionCard confirmationId={state.confirmationId} onStartOver={clear} />
          )}
        </aside>
      </div>

      <footer className="border-t border-ink-700/60">
        <ProgressBar progress={detail?.progress ?? null} busy={busy} />
      </footer>

      <ApprovalModal detail={detail} busy={busy} onDecision={handleDecision} onClose={() => {}} />
      <AuditLog open={auditOpen} onClose={() => setAuditOpen(false)} events={audit} />
      <AuditSideToggle
        visible={!!workflowId && phase !== "goal" && auditOpen === false}
        onOpen={() => setAuditOpen(true)}
      />
    </div>
  );
}

function Header({
  status,
  busy,
  onAudit,
}: {
  status: WorkflowStatus | null;
  busy: boolean;
  onAudit: () => void;
}) {
  return (
    <header className="flex items-center justify-between border-b border-ink-700/60 px-6 py-3">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-800">
          <Layers size={17} className="text-accent-soft" />
        </span>
        <span className="font-display text-lg font-semibold tracking-tight text-paper-50">
          FLOWFORGE
        </span>
      </div>
      <div className="flex items-center gap-3">
        {busy && <Loader2 size={14} className="animate-spin text-accent-soft" />}
        <span className="chip border border-ink-700 bg-ink-800 text-paper-100/70">
          {status?.replace("_", " ") ?? "demo"}
        </span>
        <button type="button" onClick={onAudit} className="btn-ghost !py-1.5 !text-xs">
          <ScrollText size={14} />
          Audit log
        </button>
      </div>
    </header>
  );
}

function SubmissionCard({
  confirmationId,
  onStartOver,
}: {
  confirmationId?: string;
  onStartOver: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="panel p-6"
    >
      <div className="flex items-center gap-2 text-ok">
        <PartyPopper size={18} />
        <span className="text-sm font-semibold">Application submitted</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-paper-100/70">
        The assembled application was submitted. Confirmation ID:
      </p>
      <p className="mt-3 rounded-lg bg-ink-900/80 px-3 py-2 text-center font-mono text-sm font-semibold text-accent-soft">
        {confirmationId ?? "FF-2026-demo"}
      </p>
      <button type="button" onClick={onStartOver} className="btn-ghost mt-4 w-full">
        <RotateCcw size={14} /> Start a new workflow
      </button>
    </motion.div>
  );
}

function AuditSideToggle({ visible, onOpen }: { visible: boolean; onOpen: () => void }) {
  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="fixed bottom-24 right-4 z-30 rounded-full border border-ink-700 bg-ink-800 px-4 py-2 text-xs font-semibold text-paper-100/80 shadow-card transition-colors hover:border-accent/50 hover:text-paper-50"
    >
      <ScrollText size={13} className="mr-1.5 inline" />
      Open audit trail
    </button>
  );
}