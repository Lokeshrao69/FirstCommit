import { Loader2, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface AppHeaderProps {
  busy: boolean;
  hasWorkflow: boolean;
  onActivity: () => void;
}

export function AppHeader({ busy, hasWorkflow, onActivity }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/95">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" width={26} height={26} />
          <span className="text-lg font-semibold tracking-tight text-text">FlowForge</span>
        </div>
        <div className="flex items-center gap-3">
          {busy && (
            <span className="inline-flex items-center gap-1.5 text-small text-muted">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              Working
            </span>
          )}
          {hasWorkflow && (
            <Button variant="secondary" size="sm" onClick={onActivity} aria-haspopup="dialog">
              <ScrollText size={15} aria-hidden="true" />
              Activity
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}