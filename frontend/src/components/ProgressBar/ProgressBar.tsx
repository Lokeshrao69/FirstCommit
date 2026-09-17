import { motion } from "framer-motion";
import type { Progress } from "@/types";
import { pct } from "@/utils/format";

interface ProgressBarProps {
  progress: Progress | null;
  busy?: boolean;
}

export function ProgressBar({ progress, busy }: ProgressBarProps) {
  const ratio = progress?.ratio ?? 0;
  const label = progress ? `${progress.completed} of ${progress.total}` : "—";
  return (
    <div className="flex items-center gap-4 px-6 py-2.5">
      <div className="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-ink-800">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-accent to-accent-soft"
          initial={{ width: 0 }}
          animate={{ width: `${(ratio * 100).toFixed(1)}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <div className="w-24 text-right font-mono text-xs text-paper-100/70">
        {busy ? "working…" : `${label} · ${pct(ratio)}`}
      </div>
    </div>
  );
}