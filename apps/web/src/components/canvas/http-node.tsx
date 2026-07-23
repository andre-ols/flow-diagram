"use client";

import type { HttpExchangeArtifact } from "@flow/lang";
import type { Node, NodeProps } from "@xyflow/react";
import { methodColor, statusColor } from "@/lib/http-colors";
import type { FlowNodeData } from "./node-types";
import { NodeShell, NodeTitle } from "./node-shell";

type FlowNode = Node<FlowNodeData>;

export function HttpNode({ data, selected }: NodeProps<FlowNode>) {
  const { node } = data;
  const exchange = node.artifacts.find(
    (artifact): artifact is HttpExchangeArtifact => artifact.kind === "http-exchange",
  );

  return (
    <NodeShell kind="http" selected={selected} tag={node.props.label}>
      {exchange ? (
        <div className="flex items-center gap-2">
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
            style={{ background: methodColor(exchange.method) }}
          >
            {exchange.method || "?"}
          </span>
          <span className="truncate font-mono text-[11px]">{exchange.path}</span>
        </div>
      ) : null}
      <NodeTitle>{node.label}</NodeTitle>
      {exchange?.response ? (
        <div className="flex items-center gap-1.5">
          <span
            className="size-1.5 rounded-full"
            style={{ background: statusColor(exchange.response.status) }}
          />
          <span className="text-[10px] text-muted-foreground">{exchange.response.status}</span>
        </div>
      ) : null}
    </NodeShell>
  );
}
