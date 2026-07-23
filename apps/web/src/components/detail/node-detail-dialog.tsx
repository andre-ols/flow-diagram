"use client";

import { useCallback, type ClipboardEvent, type DragEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { firstImageFile, isDisplayableImageSrc, readImageFileAsDataUrl } from "@/lib/image-io";
import { kindMeta } from "@/lib/kind-styles";
import { selectDisplayIr, useStudioStore } from "@/store/studio-store";
import { ArtifactView } from "./artifact-renderers";

export function NodeDetailDialog() {
  const ir = useStudioStore(selectDisplayIr);
  const selectedNodeId = useStudioStore((state) => state.selectedNodeId);
  const selectNode = useStudioStore((state) => state.selectNode);
  const setScreenImage = useStudioStore((state) => state.setScreenImage);

  const node = selectedNodeId ? ir.nodes.find((candidate) => candidate.id === selectedNodeId) : undefined;
  const pasted = useStudioStore((state) => (node ? state.screenImages[node.id] : undefined));

  const attachImage = useCallback(
    async (source: DataTransfer | null) => {
      if (!node || node.kind !== "screen") return;
      const file = firstImageFile(source);
      if (!file) return;
      setScreenImage(node.id, await readImageFileAsDataUrl(file));
    },
    [node, setScreenImage],
  );

  const onPaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => void attachImage(event.clipboardData),
    [attachImage],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      void attachImage(event.dataTransfer);
    },
    [attachImage],
  );

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (event.dataTransfer.types.includes("Files")) event.preventDefault();
  }, []);

  const meta = kindMeta(node?.kind ?? "");

  // The DSL is the source of truth: an explicit `image:` overrides the pasted
  // or dropped mockup. That same `image:` becomes an image artifact, so we drop
  // image artifacts from the generic list and render the mockup once, here.
  const mockupSrc = node?.kind === "screen" ? (node.props.image ?? pasted) : undefined;
  const otherArtifacts = node?.artifacts.filter((artifact) => artifact.kind !== "image") ?? [];

  return (
    <Dialog open={Boolean(node)} onOpenChange={(open) => !open && selectNode(null)}>
      <DialogContent
        className="max-h-[88vh] w-full gap-0 overflow-hidden p-0 sm:max-w-5xl"
        onPaste={onPaste}
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b px-5 py-4">
          <span className="size-2.5 shrink-0 rounded-sm" style={{ background: meta.color }} />
          <div className="min-w-0">
            <div
              className="text-[10px] font-bold uppercase tracking-[0.06em]"
              style={{ color: meta.color }}
            >
              {meta.label}
            </div>
            <DialogTitle className="truncate text-lg">{node?.label ?? ""}</DialogTitle>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-5 px-5 py-5">
            {node?.props.desc ? (
              <p className="text-sm leading-relaxed text-muted-foreground">{node.props.desc}</p>
            ) : null}

            {mockupSrc ? (
              isDisplayableImageSrc(mockupSrc) ? (
                <div className="overflow-hidden rounded-lg border">
                  {/* Arbitrary remote URLs and data URLs: next/image cannot help here. */}
                  <img src={mockupSrc} alt={node?.label ?? "Screen mockup"} className="w-full object-contain" />
                </div>
              ) : (
                <div className="rounded-lg border border-dashed bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
                  A browser can&apos;t load a <code className="font-mono">file://</code> path for security
                  reasons. Drop or paste the image here, or use an{" "}
                  <code className="font-mono">https://</code> URL.
                </div>
              )
            ) : null}

            {otherArtifacts.map((artifact, index) => (
              <ArtifactView key={`${artifact.kind}-${index}`} artifact={artifact} />
            ))}

            {node && otherArtifacts.length === 0 && !mockupSrc && !node.props.desc ? (
              <p className="text-sm text-muted-foreground">
                No details yet. Add properties to this component in the editor.
              </p>
            ) : null}

            {node?.kind === "screen" ? (
              <p className="text-xs text-muted-foreground">
                Drop or paste an image here to attach a mockup, or set{" "}
                <code className="font-mono">image: &quot;https://…&quot;</code> in the editor.
              </p>
            ) : null}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
