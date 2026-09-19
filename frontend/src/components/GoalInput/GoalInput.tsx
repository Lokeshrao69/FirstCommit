import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CornerDownLeft, FileCheck2, ShieldCheck, UserCheck } from "lucide-react";
import { GOAL_EXAMPLES } from "@/services/mock";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";

interface GoalInputProps {
  busy: boolean;
  disabled?: boolean;
  onStart: (goal: string) => void;
}

const MIN = 3;
const MAX = 500;

const PILLARS = [
  { icon: ShieldCheck, title: "Schema-validated plans", body: "Every generated workflow is checked before a single step runs." },
  { icon: FileCheck2, title: "Document intelligence", body: "Uploads are classified, extracted and cross-validated with confidence." },
  { icon: UserCheck, title: "Human in the loop", body: "Nothing consequential executes without your explicit approval." },
];

export function GoalInput({ busy, disabled, onStart }: GoalInputProps) {
  const [goal, setGoal] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const trimmed = goal.trim();
  const valid = trimmed.length >= MIN && trimmed.length <= MAX;

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const submit = () => {
    if (valid && !busy && !disabled) onStart(trimmed);
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
        className="text-center"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-200/80 bg-brand-50/80 px-3 py-1 shadow-sm backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-600 animate-pulse" />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-brand-700">
            Agentic Orchestration Engine
          </span>
          <span className="h-3 w-px bg-brand-200" />
          <span className="font-mono text-[10px] text-brand-600">v1.0.4</span>
        </div>

        <h1 className="mt-5 font-display text-[42px] leading-[1.05] tracking-[-0.015em] text-ink-950 sm:text-[60px]">
          From intent
          <span className="text-ink-400"> to </span>
          <span className="bg-gradient-to-r from-brand-600 via-emerald-600 to-teal-500 bg-clip-text text-transparent">
            execution.
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-ink-500 text-pretty">
          Describe what you want done. The model plans a workflow, a deterministic state machine
          runs it, and you approve every consequential step.
        </p>
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={cn(
          "panel mt-8 p-2 transition-shadow",
          "focus-within:border-brand-500 focus-within:shadow-focus",
        )}
      >
        <label htmlFor="goal" className="sr-only">
          Goal
        </label>
        <textarea
          id="goal"
          ref={ref}
          value={goal}
          maxLength={MAX}
          disabled={busy}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={3}
          placeholder="e.g. Apply for the Merit Excellence Scholarship"
          className="block w-full resize-none rounded-xl bg-transparent px-3.5 py-3 text-[15px] leading-relaxed text-ink-900 outline-none ring-0 placeholder:text-ink-400 focus-visible:ring-0 disabled:opacity-60"
        />
        <div className="flex flex-col gap-2 border-t border-line px-2 pb-1 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {GOAL_EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                disabled={busy}
                onClick={() => {
                  setGoal(example);
                  ref.current?.focus();
                }}
                className="chip chip-neutral cursor-pointer transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
              >
                {example}
              </button>
            ))}
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
            <span className="hidden shrink-0 items-center gap-1 whitespace-nowrap font-mono text-[10px] text-ink-400 sm:inline-flex">
              <CornerDownLeft size={11} /> Enter to run
            </span>
            <Button type="submit" variant="dark" size="md" loading={busy} disabled={!valid || disabled}>
              {busy ? "Planning workflow" : "Generate workflow"}
              {!busy && <ArrowRight size={15} />}
            </Button>
          </div>
        </div>
      </motion.form>

      <motion.ul
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.25 } } }}
        className="mt-10 grid gap-3 sm:grid-cols-3"
      >
        {PILLARS.map(({ icon: Icon, title, body }, idx) => (
          <motion.li
            key={title}
            variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
            className="group relative rounded-2xl border border-line bg-surface/80 p-4 text-left shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-brand-300/80 hover:shadow-raised backdrop-blur-sm"
          >
            <div className="flex items-center justify-between">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                <Icon size={15} />
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-ink-400">
                0{idx + 1} // CRITICAL
              </span>
            </div>
            <p className="mt-3 text-[13px] font-semibold text-ink-900">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-500 text-pretty">{body}</p>
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}
