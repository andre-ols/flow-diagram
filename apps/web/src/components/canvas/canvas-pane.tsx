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
import { LoopEdge, type LoopEdgeData } from "./loop-edge";
import { nodeTypeFor, nodeTypes, type FlowNodeData } from "./node-types";
import "@xyflow/react/dist/style.css";

const edgeTypes = { loop: LoopEdge };

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

  const edges = useMemo<Edge<LoopEdgeData>[]>(() => {
    const flow = ir.flows.find((candidate) => candidate.id === activeFlowId);
    if (!flow) return [];
    // Cards a backward edge (a call returning to its caller) must clear
    // before it can loop back into its target's left handle.
    const maxBottom = derivedNodes.reduce((max, node) => {
      const height = typeof node.style?.height === "number" ? node.style.height : 0;
      return Math.max(max, node.position.y + height);
    }, 0);
    return flow.edges.map((edge, index) => ({
      id: `${edge.from}-${edge.to}-${index}`,
      source: edge.from,
      target: edge.to,
      label: edge.label,
      type: "loop",
      animated: true,
      labelStyle: { fontSize: 10.5, fontWeight: 600 },
      labelBgStyle: { fill: "var(--card)" },
      data: { maxBottom },
    }));
  }, [ir, activeFlowId, derivedNodes]);

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
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={(_, node) => selectNode(node.id)}
        onPaneClick={() => selectNode(null)}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2.5}
        proOptions={{ hideAttribution: false }}
        // Whiteboard-style gestures: two-finger swipe pans, pinch zooms.
        panOnScroll
        zoomOnScroll={false}
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
