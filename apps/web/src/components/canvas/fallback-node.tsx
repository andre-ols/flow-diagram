"use client";

import type { Node, NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "./node-types";
import { NodeShell, NodeSubtitle, NodeTitle } from "./node-shell";

type FlowNode = Node<FlowNodeData>;

/**
 * Renders any kind the UI has not been taught about. A new node type added to
 * the language registry shows up here immediately rather than crashing the
 * canvas — the same open-for-extension rule the detail panel follows.
 */
export function FallbackNode({ data, selected }: NodeProps<FlowNode>) {
  const { node } = data;
  return (
    <NodeShell kind={node.kind} selected={selected} tag={node.props.label}>
      <NodeTitle>{node.label}</NodeTitle>
      <NodeSubtitle>{node.props.desc ?? node.kind}</NodeSubtitle>
    </NodeShell>
  );
}
