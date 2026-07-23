"use client";

import type { Node, NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "./node-types";
import { NodeShell, NodeSubtitle, NodeTitle } from "./node-shell";

type FlowNode = Node<FlowNodeData>;

export function ServiceNode({ data, selected }: NodeProps<FlowNode>) {
  const { node } = data;
  const isExternal = node.props.external === "true";

  return (
    <NodeShell kind="service" selected={selected} tag={node.props.label}>
      <NodeTitle>{node.label}</NodeTitle>
      {node.props.desc ? <NodeSubtitle>{node.props.desc}</NodeSubtitle> : null}
      {isExternal ? (
        <span className="w-fit rounded border border-dashed px-1.5 py-px text-[9px] text-muted-foreground">
          external
        </span>
      ) : null}
    </NodeShell>
  );
}
