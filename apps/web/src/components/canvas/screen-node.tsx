"use client";

import { useCallback, type DragEvent } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { ImageIcon } from "lucide-react";
import { firstImageFile, isDisplayableImageSrc, readImageFileAsDataUrl } from "@/lib/image-io";
import { useStudioStore } from "@/store/studio-store";
import type { FlowNodeData } from "./node-types";
import { NodeShell, NodeTitle } from "./node-shell";

type FlowNode = Node<FlowNodeData>;

export function ScreenNode({ data, selected }: NodeProps<FlowNode>) {
  const { node } = data;
  const pasted = useStudioStore((state) => state.screenImages[node.id]);
  const setScreenImage = useStudioStore((state) => state.setScreenImage);

  // The DSL is the source of truth: an explicit `image:` overrides a dropped or
  // pasted mockup. The pasted image is the fallback when the DSL says nothing.
  const src = node.props.image ?? pasted;
  const displayable = isDisplayableImageSrc(src);

  const onDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const file = firstImageFile(event.dataTransfer);
      if (!file) return;
      setScreenImage(node.id, await readImageFileAsDataUrl(file));
    },
    [node.id, setScreenImage],
  );

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    // Both handlers must cancel the default for the drop to fire.
    if (event.dataTransfer.types.includes("Files")) event.preventDefault();
  }, []);

  return (
    <NodeShell kind="screen" selected={selected} tag={node.props.label}>
      <NodeTitle>{node.label}</NodeTitle>
      <div
        className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md border border-dashed bg-muted/40"
        onDrop={onDrop}
        onDragOver={onDragOver}
        title="Drop an image here to attach a mockup"
      >
        {displayable ? (
          // A data URL or an arbitrary remote mockup: next/image cannot help here.
          <img src={src} alt={node.label} className="h-full w-full object-cover" />
        ) : (
          <span className="flex items-center gap-1 px-2 text-center text-[10px] text-muted-foreground">
            <ImageIcon className="size-3 shrink-0" aria-hidden />
            {src ? "local path can't load — drop the image" : "drop image"}
          </span>
        )}
      </div>
    </NodeShell>
  );
}
