import { motion } from "framer-motion";
import { cn } from "@/utils/cn";

interface HeroAtmosphereProps {
  className?: string;
}

export function HeroAtmosphere({ className }: HeroAtmosphereProps) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden select-none", className)}>
      {/* Cybernetic grid with radial fade */}
      <div className="absolute inset-0 bg-cyber-grid opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_80%)]" />

      {/* Ambient radial blur orbs */}
      <motion.div
        className="absolute -top-24 left-1/2 -translate-x-1/2 w-[650px] h-[350px] rounded-full bg-gradient-to-tr from-brand-500/10 via-emerald-400/15 to-purple-500/10 blur-3xl"
        animate={{
          scale: [1, 1.06, 1],
          opacity: [0.6, 0.85, 0.6],
        }}
        transition={{
          duration: 7,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Subtle secondary glow spots */}
      <div className="absolute top-1/3 -left-32 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="absolute top-1/2 -right-32 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl" />

      {/* Subtle code particle accents */}
      <div className="absolute inset-x-0 top-0 h-40 opacity-20 font-mono text-[9px] text-brand-700 select-none overflow-hidden leading-tight flex justify-around">
        <span className="hidden sm:inline">01000110 01101100 01101111 01110111</span>
        <span className="hidden md:inline">01000110 01101111 01110010 01100111 01100101</span>
        <span className="hidden lg:inline">DAG::COMPILED_DETERMINISTIC_STATE</span>
        <span>LANGGRAPH::VERIFIED</span>
      </div>
    </div>
  );
}
