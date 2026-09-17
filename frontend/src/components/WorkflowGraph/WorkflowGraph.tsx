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
import type { WorkflowDetail } from "@/types";
import { layout } from "@/utils/layout";
import { StateNode, type StateNodeType } from "./StateNode";

interface WorkflowGraphProps {
  detail: WorkflowDetail | null;
}

export function WorkflowGraph({ detail }: WorkflowGraphProps) {
  const { nodes, edges } = useMemo(() => {
    if (!detail) return { nodes: [], edges: [] };
    const positions = layout(detail.states, "eligibility_check");
    const posById = new Map(positions.map((p) => [p.id, { x: p.x, y: p.y }]));
    const activeId = detail.current_state;

    const nodes: StateNodeType[] = detail.states.map((s) => ({
      id: s.id,
      type: "stateNode",
      position: posById.get(s.id) ?? { x: 0, y: 0 },
      data: {
        label: s.label,
        description: s.description,
        type: s.type,
        status: s.status,
      },
    }));

    const edges: Edge[] = detail.states.flatMap((s) =>
      s.transitions.map((t, idx) => ({
        id: `${s.id}->${t.target}-${idx}`,
        source: s.id,
        target: t.target,
        animated: s.id === activeId,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        style: s.id === activeId ? { stroke: "#4f6bff", strokeWidth: 2 } : { stroke: "#242f4a" },
      })),
    );
    return { nodes, edges };
  }, [detail]);

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
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#242f4a" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}