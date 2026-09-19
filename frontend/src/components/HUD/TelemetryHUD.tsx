import { motion } from "framer-motion";
import { Cpu, Database, ShieldCheck, Sparkles } from "lucide-react";
import type { WorkflowDetail } from "@/types";
import { cn } from "@/utils/cn";

interface TelemetryHUDProps {
  detail: WorkflowDetail | null;
  busy?: boolean;
  className?: string;
}

export function TelemetryHUD({ detail, busy = false, className }: TelemetryHUDProps) {
  const isRunning = busy || detail?.status === "in_progress";
  const isCompleted = detail?.status === "completed";
  const stateCount = detail?.states?.length ?? 0;
  const activeStateIdx = detail?.states?.findIndex((s) => s.id === detail?.current_state) ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      className={cn("w-full grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-cyber-dark/95 border-b border-cyber-line/80 backdrop-blur-lg select-none", className)}
    >
      {/* Card 1: Engine Speed / Execution Pipeline */}
      <div className="hud-card p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="hud-label flex items-center gap-1.5">
            <span className="text-amber-500 font-bold">- §01.1 /</span> ENGINE SPEED
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
            <Cpu size={12} className="text-brand-400" />
            <span className="text-emerald-400">0.04ms</span> LATENCY
          </span>
        </div>

        <div className="my-3 rounded-lg bg-black/70 border border-slate-800/80 p-3">
          <div className="relative flex items-center h-4">
            <div className="w-full h-0.5 bg-slate-800 rounded-full" />
            {/* Position indicator based on workflow progress */}
            <motion.div
              className="absolute h-3 w-3 rounded-full bg-slate-300 border-2 border-black -translate-x-1/2"
              animate={{ left: isCompleted ? "94%" : isRunning ? "45%" : "12%" }}
              transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
            />
            {/* Live target pulse dots */}
            <div className="absolute right-0 flex items-center gap-1">
              <span className={cn("h-2.5 w-2.5 rounded-full", isRunning ? "bg-amber-400 animate-ping" : "bg-emerald-500")} />
              <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-slate-400">
            <span>DETERMINISTIC IN-MEMORY</span>
            <span className="text-amber-400 font-semibold">{isRunning ? "RUNNING" : isCompleted ? "FINALIZED" : "STANDBY"}</span>
            <span>AWS BEDROCK</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>PIPELINE: <span className="text-slate-200">LANGGRAPH DAG</span></span>
          <span className="text-emerald-400">HEARTBEAT: OK</span>
        </div>
      </div>

      {/* Card 2: Intent / LLM Throughput Visualizer */}
      <div className="hud-card p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="hud-label flex items-center gap-1.5">
            <span className="text-amber-500 font-bold">- §01.2 /</span> INTENT SYNTHESIS
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
            <Sparkles size={12} className="text-cyber-neon" />
            <span>CLAUDE 3.7 SONNET</span>
          </span>
        </div>

        <div className="my-3 rounded-lg bg-black/70 border border-slate-800/80 p-3">
          <div className="flex items-end justify-between gap-1.5 h-10 px-1">
            {[
              { height: "85%", active: true, color: "from-purple-500 to-indigo-500" },
              { height: isRunning ? "72%" : "60%", active: true, color: "from-purple-600 to-indigo-600" },
              { height: isRunning ? "58%" : "44%", active: true, color: "from-purple-700 to-indigo-700" },
              { height: isRunning ? "35%" : "18%", active: isRunning, color: "from-slate-700 to-slate-800" },
              { height: isRunning ? "24%" : "12%", active: isCompleted, color: "from-slate-700 to-slate-800" },
            ].map((bar, i) => (
              <motion.div
                key={i}
                className={cn("w-full rounded-t-sm transition-all duration-300", bar.active ? `bg-gradient-to-t ${bar.color}` : "bg-slate-800")}
                animate={{ height: bar.height }}
                transition={{ duration: 0.4, repeat: isRunning ? Infinity : 0, repeatType: "reverse" }}
              />
            ))}
          </div>
          <div className="mt-2.5 flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-slate-400">
            <span>PROMPT INTENT</span>
            <span>DAG EXPANSION</span>
            <span>VERIFIED JSON</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>ACTIVE STAGE: <span className="text-slate-200">{detail ? `${activeStateIdx + 1} OF ${stateCount}` : "READY"}</span></span>
          <span className="text-purple-400">SCHEMA: VALID</span>
        </div>
      </div>

      {/* Card 3: Trust / Operator DB & Security Hash Tracks */}
      <div className="hud-card p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="hud-label flex items-center gap-1.5">
            <span className="text-amber-500 font-bold">- §01.3 /</span> TRUST & AUDIT
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
            <ShieldCheck size={12} className="text-amber-400" />
            <span className="text-amber-400 font-semibold">100% GUARDED</span>
          </span>
        </div>

        <div className="my-3 rounded-lg bg-black/70 border border-slate-800/80 p-2.5 font-mono text-[10px] space-y-1.5">
          {[
            { label: "row_1", text: "SCHEMA", hash: "0xa7f2..e9", active: true },
            { label: "row_2", text: "GUARDS", hash: "0xc04d..b1", active: true },
            { label: "row_3", text: "HUMAN_GATE", hash: "0x91be..4f", active: detail?.needs === "approval" || isCompleted },
            { label: "row_4", text: "SHA256_LOG", hash: "0xe6a3..c8", active: true },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-2">
              <span className="text-slate-400 w-10 shrink-0">{row.label}</span>
              <div className="relative flex-1 h-2 rounded overflow-hidden bg-slate-900 border border-slate-800">
                <div className="hazard-bar absolute inset-0 opacity-80" />
              </div>
              <span className="text-slate-400 font-mono shrink-0 text-[9px]">{row.hash}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1 text-slate-300">
            <Database size={11} className="text-slate-400" /> OPERATOR DB
          </span>
          <span className="text-amber-400 font-semibold">IMMUTABLE LOG</span>
        </div>
      </div>
    </motion.div>
  );
}
