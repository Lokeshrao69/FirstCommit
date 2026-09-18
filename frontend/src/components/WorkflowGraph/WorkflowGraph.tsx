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

interface WorkflowGraphProps {
  workflow: WorkflowDefinition | WorkflowDetail | null;
}

/** Works with either a plan definition (all states pending) or a live detail. */
export function WorkflowGraph({ workflow }: WorkflowGraphProps) {
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
      };
      return {
        id: s.id,
        type: "stateNode",
        position: posById.get(s.id) ?? { x: 0, y: 0 },
        data,
      };
    });

    const edges: Edge[] = states.flatMap((s) =>
      s.transitions.map((t, idx) => ({
        id: `${s.id}->${t.target}-${idx}`,
        source: s.id,
        target: t.target,
        animated: s.id === activeId,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
          color: s.id === activeId ? "var(--primary)" : "var(--text-muted)",
        },
        style:
          s.id === activeId
            ? { stroke: "var(--primary)", strokeWidth: 2 }
            : { stroke: "var(--border)", strokeWidth: 1.5 },
      })),
    );
    return { nodes, edges };
  }, [workflow]);

  const nodeTypes = useMemo(() => ({ stateNode: StateNode }), []);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
        minZoom={0.3}
        maxZoom={1.5}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="var(--border)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}