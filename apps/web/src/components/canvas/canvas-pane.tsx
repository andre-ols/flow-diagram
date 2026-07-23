"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { layoutFlow, sizeOf } from "@flow/layout";
import { selectDisplayIr, useStudioStore } from "@/store/studio-store";
import { CanvasControls } from "./canvas-controls";
import { nodeTypeFor, nodeTypes, type FlowNodeData } from "./node-types";
import "@xyflow/react/dist/style.css";

function CanvasInner() {
  const ir = useStudioStore(selectDisplayIr);
  const activeFlowId = useStudioStore((state) => state.activeFlowId);
  const manualPositions = useStudioStore((state) => state.manualPositions);
  const selectedNodeId = useStudioStore((state) => state.selectedNodeId);
  const selectNode = useStudioStore((state) => state.selectNode);
  const setNodePosition = useStudioStore((state) => state.setNodePosition);

  const layout = useMemo(() => layoutFlow(ir, activeFlowId ?? ""), [ir, activeFlowId]);

  // Nodes derived from the IR, layout, committed positions and selection. This
  // is the source of truth; live drag positions live only in React Flow's local
  // state below until the drag ends, so mid-drag frames never rebuild this.
  const derivedNodes = useMemo<Node<FlowNodeData>[]>(() => {
    return Object.keys(layout.positions).flatMap((id) => {
      const node = ir.nodes.find((candidate) => candidate.id === id);
      const auto = layout.positions[id];
      if (!node || !auto) return [];
      const size = sizeOf(node.kind);
      return [
        {
          id,
          type: nodeTypeFor(node.kind),
          position: manualPositions[id] ?? auto,
          data: { node },
          selected: selectedNodeId === id,
          style: { width: size.width, height: size.height },
        },
      ];
    });
  }, [ir, layout, manualPositions, selectedNodeId]);

  const edges = useMemo<Edge[]>(() => {
    const flow = ir.flows.find((candidate) => candidate.id === activeFlowId);
    if (!flow) return [];
    return flow.edges.map((edge, index) => ({
      id: `${edge.from}-${edge.to}-${index}`,
      source: edge.from,
      target: edge.to,
      label: edge.label,
      type: "smoothstep",
      animated: true,
      labelStyle: { fontSize: 10.5, fontWeight: 600 },
      labelBgStyle: { fill: "var(--card)" },
    }));
  }, [ir, activeFlowId]);

  // React Flow owns the transient drag state so a card follows the cursor
  // smoothly without rebuilding the whole graph (and without flickering edge
  // labels) on every frame. We only commit the final position to the store.
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState<Node<FlowNodeData>>(derivedNodes);

  useEffect(() => {
    setNodes(derivedNodes);
  }, [derivedNodes, setNodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<FlowNodeData>>[]) => {
      onNodesChangeInternal(changes);
      for (const change of changes) {
        if (change.type === "position" && change.position && change.dragging === false) {
          setNodePosition(change.id, change.position);
        }
      }
    },
    [onNodesChangeInternal, setNodePosition],
  );

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={(_, node) => selectNode(node.id)}
        onPaneClick={() => selectNode(null)}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2.5}
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--canvas-dot)" />
      </ReactFlow>
      <CanvasControls />
    </div>
  );
}

export function CanvasPane() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
