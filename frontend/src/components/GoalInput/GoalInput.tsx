import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { GOAL_EXAMPLES } from "@/services/mock";

interface GoalInputProps {
  busy: boolean;
  onStart: (goal: string) => void;
}

export function GoalInput({ busy, onStart }: GoalInputProps) {
  const [goal, setGoal] = useState("");

  const submit = () => {
    const trimmed = goal.trim();
    if (trimmed.length >= 3) onStart(trimmed);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="panel max-w-xl p-8"
    >
      <div className="mb-2 flex items-center gap-2 text-accent-soft">
        <Sparkles size={16} />
        <span className="text-xs font-semibold uppercase tracking-widest">FlowForge</span>
      </div>
      <h2 className="font-display text-2xl font-semibold text-paper-50">
        What do you want to get done?
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-paper-100/70">
        Give the engine a goal. It plans a workflow, the state machine executes it, and you stay
        in control at every approval gate.
      </p>

      <textarea
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
        rows={3}
        placeholder="e.g. Apply for the Merit Excellence Scholarship"
        className="mt-6 w-full resize-none rounded-xl border border-ink-700 bg-ink-900/70 px-4 py-3 text-sm text-paper-50 outline-none transition placeholder:text-paper-100/30 focus:border-accent focus:shadow-glow"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {GOAL_EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setGoal(example)}
            className="chip cursor-pointer border border-ink-700 bg-ink-800 text-paper-100/80 transition-colors hover:border-accent/50 hover:text-paper-50"
          >
            {example}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={busy || goal.trim().length < 3}
        className="btn-primary mt-6 w-full"
      >
        {busy ? "Planning workflow…" : "Generate workflow"}
        <ArrowRight size={16} />
      </button>
    </motion.div>
  );
}