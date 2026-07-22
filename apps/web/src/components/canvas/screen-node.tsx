"use client";

import type { Node, NodeProps } from "@xyflow/react";
import { ImageIcon } from "lucide-react";
import { useStudioStore } from "@/store/studio-store";
import type { FlowNodeData } from "./node-types";
import { NodeShell, NodeTitle } from "./node-shell";

type FlowNode = Node<FlowNodeData>;

export function ScreenNode({ data, selected }: NodeProps<FlowNode>) {
  const { node } = data;
  const pasted = useStudioStore((state) => state.screenImages[node.id]);
  const src = pasted ?? node.props.image;

  return (
    <NodeShell kind="screen" selected={selected}>
      <NodeTitle>{node.label}</NodeTitle>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md border border-dashed bg-muted/40">
        {src ? (
          // A data URL or an arbitrary remote mockup: next/image cannot help here.
          <img src={src} alt={node.label} className="h-full w-full object-cover" />
        ) : (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <ImageIcon className="size-3" aria-hidden />
            no mockup
          </span>
        )}
      </div>
    </NodeShell>
  );
}
