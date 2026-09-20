import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { WorkflowDefinition, WorkflowDetail } from "@/types";
import { layout } from "@/utils/layout";
import { findRoot } from "@/utils/workflow";
import { StateNode, type StateNodeData, type StateNodeType } from "./StateNode";
import { MobileTimeline } from "./MobileTimeline";

interface WorkflowGraphProps {
  workflow: WorkflowDefinition | WorkflowDetail | null;
  className?: string;
}

/** The forged execution map. Works with a plan (all pending) or a live detail.
 *  Above `md` it's the graph; on small screens it collapses to a vertical
 *  execution timeline so the path is still readable top-to-bottom. */
export function WorkflowGraph({ workflow, className = "" }: WorkflowGraphProps) {
  const { nodes, edges } = useMemo(() => {
    if (!workflow) return { nodes: [], edges: [] };
    const states = workflow.states;
    const isDefinition = "initial_state" in workflow;
    const root =
      isDefinition && workflow.initial_state ? workflow.initial_state : findRoot(states);
    const activeId = "current_state" in workflow ? workflow.current_state : null;

    const positions = layout(states, root || states[0]?.id || "");
    const posById = new Map(positions.map((p) => [p.id, { x: p.x, y: p.y }]));

    const nodes: StateNodeType[] = states.map((s) => {
      const data: StateNodeData = {
        label: s.label,
        description: s.description,
        type: s.type,
        status: isDefinition ? "pending" : s.status,
        active: s.id === activeId,
        stageId: s.id,
      };
      return {
        id: s.id,
        type: "stateNode",
        position: posById.get(s.id) ?? { x: 0, y: 0 },
        data,
      };
    });

    const statusOf = (id: string): string => {
      const st = states.find((x) => x.id === id);
      if (!st) return "pending";
      return isDefinition ? "pending" : st.status;
    };

    const edges: Edge[] = states.flatMap((s) =>
      s.transitions.map((t, idx) => {
        const from = statusOf(s.id);
        const to = statusOf(t.target);
        const pathDone = from === "completed" && to === "completed";
        const leadsToBlock = to === "blocked" || to === "failed";
        const fromActive = s.id === activeId;
        const color = leadsToBlock
          ? "var(--error)"
          : pathDone
            ? "var(--success)"
            : fromActive
              ? "var(--primary)"
              : "rgb(var(--text-muted) / 0.5)";
        return {
          id: `${s.id}->${t.target}-${idx}`,
          source: s.id,
          target: t.target,
          animated: fromActive && !leadsToBlock,
          type: "default",
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 16,
            height: 16,
            color,
          },
          style: {
            stroke: color,
            strokeWidth: fromActive ? 2.4 : pathDone ? 2.6 : 1.5,
            strokeDasharray: leadsToBlock ? "5 4" : undefined,
          },
        };
      }),
    );
    return { nodes, edges };
  }, [workflow]);

  const nodeTypes = useMemo(() => ({ stateNode: StateNode }), []);

  return (
    <div className={`h-full w-full ${className}`}>
      <div className="hidden h-full w-full md:block">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.16, maxZoom: 1 }}
          minZoom={0.28}
          maxZoom={1.4}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnScroll
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={26} size={1.1} color="rgb(var(--text-muted) / 0.22)" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <div className="h-full w-full md:hidden">
        <MobileTimeline workflow={workflow} />
      </div>
    </div>
  );
}