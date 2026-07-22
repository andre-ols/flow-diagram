"use client";

import type { ErModelArtifact } from "@flow/lang";
import type { Node, NodeProps } from "@xyflow/react";
import { Table2 } from "lucide-react";
import type { FlowNodeData } from "./node-types";
import { NodeShell, NodeSubtitle, NodeTitle } from "./node-shell";

type FlowNode = Node<FlowNodeData>;

export function DbNode({ data, selected }: NodeProps<FlowNode>) {
  const { node } = data;
  const model = node.artifacts.find(
    (artifact): artifact is ErModelArtifact => artifact.kind === "er-model",
  );
  const count = model?.tables.length ?? 0;

  return (
    <NodeShell kind="db" selected={selected}>
      <NodeTitle>{node.label}</NodeTitle>
      <NodeSubtitle>
        <span className="flex items-center gap-1.5">
          <Table2 className="size-3" aria-hidden />
          {count} {count === 1 ? "table" : "tables"}
        </span>
      </NodeSubtitle>
    </NodeShell>
  );
}
