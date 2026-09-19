import { motion } from "framer-motion";
import { Activity, CheckCircle2, ShieldCheck, Zap } from "lucide-react";
import { cn } from "@/utils/cn";

interface StatsTickerProps {
  className?: string;
}

const STATS = [
  {
    value: "99.2%",
    label: "Deterministic Accuracy",
    detail: "Zero hallucinated state leaps",
    icon: CheckCircle2,
    color: "text-emerald-500",
  },
  {
    value: "120+",
    label: "Transition Invariants",
    detail: "Pre-validated DAG topology",
    icon: ShieldCheck,
    color: "text-brand-600",
  },
  {
    value: "0.04ms",
    label: "In-Memory Latency",
    detail: "Microsecond state evaluations",
    icon: Zap,
    color: "text-amber-500",
  },
  {
    value: "24/7",
    label: "Policy Governance",
    detail: "Human approval for key actions",
    icon: Activity,
    color: "text-purple-500",
  },
];

export function StatsTicker({ className }: StatsTickerProps) {
  return (
    <div className={cn("w-full border-y border-line bg-surface/70 backdrop-blur-md py-6 px-4 sm:px-8", className)}>
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-line/60">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="font-mono text-xs uppercase tracking-widest text-ink-500 font-semibold">
              Live Orchestration Telemetry
            </span>
          </div>
          <span className="font-mono text-[11px] text-ink-400">
            ENGINE STATUS: <strong className="text-emerald-600 font-semibold">OPTIMAL</strong> · PROVIDER: <strong className="text-ink-700">BEDROCK / CLAUDE 3.7</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: i * 0.08, ease: [0.32, 0.72, 0, 1] }}
                className="group flex flex-col"
              >
                <div className="flex items-center gap-1.5">
                  <Icon size={14} className={stat.color} />
                  <span className="text-2xl sm:text-3xl font-display font-medium text-ink-950 tracking-tight">
                    {stat.value}
                  </span>
                </div>
                <span className="mt-1 text-xs font-semibold text-ink-900 tracking-tight">
                  {stat.label}
                </span>
                <span className="text-[11px] text-ink-500 leading-tight mt-0.5">
                  {stat.detail}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
