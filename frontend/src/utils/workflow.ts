/**
 * Pure, framework-free helpers for the guided flow.
 * No React imports; everything here is testable in isolation.
 */

import type { WorkflowState } from "@/types";
import { DOC_LABELS } from "@/types";
import type { DemoPhase } from "@/hooks/useWorkflow";

export type StepKey = "plan" | "documents" | "review" | "submit";

/** Order non-terminal states along the "happy path": walk transitions from the
 *  initial state, preferring the first transition at each step, avoiding
 *  visited states, then append any unreachable non-terminal states. */
export function orderedSteps(
  states: WorkflowState[],
  initialState: string,
): WorkflowState[] {
  const byId = new Map(states.map((s) => [s.id, s]));
  const visited = new Set<string>();
  const order: WorkflowState[] = [];

  let current = initialState;
  for (let i = 0; i < states.length && current; i += 1) {
    if (visited.has(current)) break;
    const state = byId.get(current);
    if (!state) break;
    visited.add(current);
    if (state.type !== "terminal") order.push(state);
    const next = state.transitions.find(
      (t) => byId.has(t.target) && !visited.has(t.target),
    );
    current = next?.target ?? "";
  }

  for (const s of states) {
    if (s.type !== "terminal" && !visited.has(s.id)) order.push(s);
  }
  return order;
}

/** Fallback root: the first state that is not a transition target of any
 *  other state (an un-referenced state), e.g. the initial state. */
export function findRoot(states: WorkflowState[]): string {
  const targets = new Set<string>();
  for (const s of states) {
    for (const t of s.transitions) targets.add(t.target);
  }
  const root = states.find((s) => !targets.has(s.id));
  return root?.id ?? states[0]?.id ?? "";
}

/** The state that defines the required documents for this workflow. */
export function documentState(states: WorkflowState[]): WorkflowState | undefined {
  return states.find((s) => s.type === "document_required");
}

/** Human label for a document key: known labels, else snake_case -> Sentence case. */
export function docLabel(key: string): string {
  if (DOC_LABELS[key]) return DOC_LABELS[key];
  return humanise(key);
}

/** snake_case / kebab-case -> "Sentence case" */
export function humanise(key: string): string {
  const words = String(key)
    .split(/[_-]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
  if (words.length === 0) return key;
  const [first, ...rest] = words;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(" ");
}

/** Which stepper step (if any) a phase maps to. */
export function stepFor(phase: DemoPhase): StepKey | null {
  switch (phase) {
    case "plan":
      return "plan";
    case "documents":
      return "documents";
    case "review":
      return "review";
    case "submit":
      return "submit";
    default:
      return null;
  }
}