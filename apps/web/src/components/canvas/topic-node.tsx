"use client";

import type { Node, NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "./node-types";
import { NodeShell, NodeSubtitle } from "./node-shell";

type FlowNode = Node<FlowNodeData>;

export function TopicNode({ data, selected }: NodeProps<FlowNode>) {
  const { node } = data;
  return (
    <NodeShell kind="topic" selected={selected} tag={node.props.label}>
      {/* A topic's name is its address, so it reads as code rather than prose. */}
      <div className="truncate font-mono text-[12.5px] font-semibold leading-tight">
        {node.label}
      </div>
      {node.props.broker ? (
        <span className="w-fit rounded border px-1.5 py-px text-[9px] uppercase text-muted-foreground">
          {node.props.broker}
        </span>
      ) : null}
      {node.props.desc ? <NodeSubtitle>{node.props.desc}</NodeSubtitle> : null}
    </NodeShell>
  );
}
