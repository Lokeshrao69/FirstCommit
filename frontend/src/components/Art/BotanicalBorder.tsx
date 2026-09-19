import { Sparkles } from "lucide-react";
import { cn } from "@/utils/cn";

interface BotanicalBorderProps {
  className?: string;
  showText?: boolean;
}

export function BotanicalBorder({ className, showText = true }: BotanicalBorderProps) {
  return (
    <div className={cn("relative w-full overflow-hidden bg-[#0c0d10] text-slate-200 border-t border-slate-800/80 select-none", className)}>
      {/* Editorial branding row (Orbit style) */}
      {showText && (
        <div className="relative z-10 mx-auto max-w-5xl px-6 pt-6 pb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-xl tracking-wider text-slate-100 uppercase font-semibold">
                ORBIT ENGINE
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/80 border border-emerald-700/60 px-2 py-0.5 font-mono text-[10px] text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                DETERMINISTIC
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400 font-sans">
              Every workflow, deterministically connected.
            </p>
          </div>

          <div className="flex items-center gap-6 text-[12px] text-slate-400 font-mono">
            <span className="flex items-center gap-1.5">
              <Sparkles size={12} className="text-amber-400" />
              <span>SCHEMA LOCKED</span>
            </span>
            <span>&copy; {new Date().getFullYear()} FlowForge</span>
          </div>
        </div>
      )}

      {/* Wildflower embroidery pixel-art banner */}
      <div className="relative w-full h-24 sm:h-32 md:h-40 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0c0d10] via-transparent to-black/80 z-[1] pointer-events-none" />
        <img
          src="/art/wildflower_banner.jpg"
          alt="Botanical wildflower garden border"
          className="w-full h-full object-cover object-bottom filter brightness-95 contrast-105"
          loading="lazy"
        />
      </div>
    </div>
  );
}
