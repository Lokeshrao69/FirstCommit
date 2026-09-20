/**
 * Deterministic vertical auto-layout for the workflow graph.
 *
 * Layers states by distance from the initial state (BFS); states in the same
 * layer are stacked by traversal order so each path reads top-to-bottom.
 */

import type { WorkflowState } from "../types";

export interface LayoutPos {
  id: string;
  x: number;
  y: number;
}

const NODE_W = 280;
const NODE_H = 132;
const COL_GAP = 88;
const ROW_GAP = 40;

export function layout(states: WorkflowState[], initial: string): LayoutPos[] {
  const byId = new Map(states.map((s) => [s.id, s]));
  const layer = new Map<string, number>();
  const layerOrder: string[][] = [];

  // BFS layering
  let queue: string[] = [initial];
  layer.set(initial, 0);
  layerOrder.push([initial]);

  const enqueue = (id: string, nextLayer: number) => {
    const cur = layer.get(id);
    if (cur !== undefined && cur <= nextLayer) return;
    layer.set(id, nextLayer);
    while (layerOrder.length <= nextLayer) layerOrder.push([]);
    layerOrder[nextLayer].push(id);
  };

  const visited = new Set<string>([initial]);
  while (queue.length > 0) {
    const frontier: string[] = [];
    for (const id of queue) {
      const state = byId.get(id);
      if (!state) continue;
      const l = layer.get(id) ?? 0;
      for (const t of state.transitions) {
        enqueue(t.target, l + 1);
        if (byId.has(t.target) && !visited.has(t.target)) {
          visited.add(t.target);
          frontier.push(t.target);
        }
      }
    }
    queue = frontier;
  }

  // Any state not reached (isolated) lands in the last layer
  for (const s of states) {
    if (!layer.has(s.id)) {
      const l = layerOrder.length;
      layer.set(s.id, l);
      layerOrder.push([s.id]);
    }
  }

  const cols = layerOrder.length;
  const rows = Math.max(...layerOrder.map((r) => r.length));
  const totalW = cols * NODE_W + (cols - 1) * COL_GAP;
  const totalH = rows * NODE_H + (rows - 1) * ROW_GAP;

  const positions: LayoutPos[] = [];
  layerOrder.forEach((col, li) => {
    const x = li * (NODE_W + COL_GAP) - totalW / 2 + NODE_W / 2;
    col.forEach((id, ri) => {
      const yStart = -totalH / 2 + NODE_H / 2;
      const y = yStart + ri * (NODE_H + ROW_GAP);
      positions.push({ id, x, y });
    });
  });
  return positions;
}