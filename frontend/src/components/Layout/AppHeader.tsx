import { ScrollText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ApiMode } from "@/services/api";

interface AppHeaderProps {
  busy: boolean;
  hasWorkflow: boolean;
  goal?: string;
  workflowId?: string | null;
  apiMode: ApiMode;
  /** Humanized label of the state the engine is currently operating in. */
  liveOperation?: string | null;
  liveNeeds?: string | null;
  onActivity: () => void;
}

const NEEDS_COPY: Record<string, string> = {
  document_upload: "collecting documents",
  user_input: "needs input",
  approval: "awaiting your call",
};

export function AppHeader({
  busy,
  hasWorkflow,
  goal,
  workflowId,
  apiMode,
  liveOperation,
  liveNeeds,
  onActivity,
}: AppHeaderProps) {
  const opLabel = (liveNeeds && NEEDS_COPY[liveNeeds]) || liveOperation || null;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-4 sm:px-6">
        <a href="/" className="flex shrink-0 items-center gap-2.5" aria-label="FlowForge home">
          <span className="grid h-8 w-8 place-items-center rounded-control border border-primary/50 bg-surface-2 shadow-ember">
            <img src="/favicon.svg" alt="" width={20} height={20} />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-[17px] font-semibold tracking-tight text-text">
              FlowForge
            </span>
            <span className="mt-0.5 hidden font-mono text-[10px] tracking-[0.18em] text-faint sm:block">
              intent → execution
            </span>
          </span>
        </a>

        {apiMode === "mock" && import.meta.env.DEV && (
          <span className="hidden rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[10px] font-medium tracking-wide text-accent md:inline-flex">
            demo data
          </span>
        )}
        {apiMode === "live" && (
          <span className="hidden rounded-full border border-success/30 bg-success/10 px-2 py-0.5 font-mono text-[10px] font-medium tracking-wide text-success md:inline-flex">
            live api
          </span>
        )}

        <div className="hidden min-w-0 flex-1 items-center gap-3 md:flex">
          <span aria-hidden="true" className="h-4 w-px shrink-0 bg-border" />
          {hasWorkflow && (
            <span className="min-w-0 flex-1 truncate text-small text-muted">
              {goal || "Workflow in progress"}
            </span>
          )}
          {hasWorkflow && opLabel && (
            <span className="flex shrink-0 items-center gap-1.5 rounded-control border border-primary/25 bg-primary/8 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-primary">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 animate-pulse-ember rounded-full bg-primary"
              />
              {opLabel}
            </span>
          )}
          {workflowId && (
            <span className="shrink-0 font-mono text-[11px] text-faint">{workflowId}</span>
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          {busy && hasWorkflow && (
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-primary md:hidden">
              <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse-ember rounded-full bg-primary" />
              Working
            </span>
          )}
          {hasWorkflow && (
            <Button variant="secondary" size="sm" onClick={onActivity} aria-haspopup="dialog">
              <ScrollText size={15} aria-hidden="true" />
              <span className="hidden sm:inline">Activity</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}