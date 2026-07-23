"use client";

import { useCallback, type ClipboardEvent, type DragEvent } from "react";
import { Maximize2 } from "lucide-react";
import { LabelChip } from "@/components/label-chip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { firstImageFile, isDisplayableImageSrc, readImageFileAsDataUrl } from "@/lib/image-io";
import { kindMeta } from "@/lib/kind-styles";
import { selectDisplayIr, useStudioStore } from "@/store/studio-store";
import { ArtifactView } from "./artifact-renderers";

/**
 * The compact detail modal for a selected card: a lean read-only view of the
 * node's data. Cards with a zoomable artifact (a db model or a screenshot) get
 * a button that promotes them into full-screen focus mode.
 */
export function NodeDetailDialog() {
  const ir = useStudioStore(selectDisplayIr);
  const selectedNodeId = useStudioStore((state) => state.selectedNodeId);
  const focusNodeId = useStudioStore((state) => state.focusNodeId);
  const selectNode = useStudioStore((state) => state.selectNode);
  const enterFocus = useStudioStore((state) => state.enterFocus);
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

  // The DSL is the source of truth: an explicit `image:` overrides a pasted
  // mockup. Its image artifact is rendered here, so drop it from the list.
  const mockupSrc = node?.kind === "screen" ? (node.props.image ?? pasted) : undefined;
  const listArtifacts = node?.artifacts.filter((artifact) => artifact.kind !== "image") ?? [];
  const hasErModel = node?.artifacts.some((artifact) => artifact.kind === "er-model") ?? false;
  // http and topic have no zoomable visual, but still open full-screen for a
  // roomier read of their payloads (focus mode falls back to a scroll sheet).
  const scrollFocusKind = node?.kind === "http" || node?.kind === "topic";
  const canFocus =
    scrollFocusKind || (Boolean(mockupSrc) && isDisplayableImageSrc(mockupSrc)) || hasErModel;

  // The modal stays mounted behind focus mode; hide it while focus is open.
  const open = Boolean(node) && !focusNodeId;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && selectNode(null)}>
      <DialogContent
        className="max-h-[86vh] w-full gap-0 overflow-hidden p-0 sm:max-w-3xl"
        onPaste={onPaste}
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b py-4 pl-5 pr-16">
          <span className="size-2.5 shrink-0 rounded-sm" style={{ background: meta.color }} />
          <div className="min-w-0 flex-1">
            <div
              className="text-[10px] font-bold uppercase tracking-[0.06em]"
              style={{ color: meta.color }}
            >
              {meta.label}
            </div>
            <DialogTitle className="truncate text-lg">{node?.label ?? ""}</DialogTitle>
          </div>
          {node?.props.label ? (
            <LabelChip label={node.props.label} color={meta.color} className="shrink-0" />
          ) : null}
          {canFocus ? (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => enterFocus()}
              title="Open focus mode"
            >
              <Maximize2 className="size-3.5" />
              Focus
            </Button>
          ) : null}
        </DialogHeader>

        <div className="max-h-[70vh] overflow-auto">
          <div className="space-y-5 px-5 py-5">
            {node?.props.desc ? (
              <p className="text-sm leading-relaxed text-muted-foreground">{node.props.desc}</p>
            ) : null}

            {mockupSrc ? (
              isDisplayableImageSrc(mockupSrc) ? (
                <button
                  type="button"
                  onClick={() => enterFocus()}
                  className="block w-full overflow-hidden rounded-lg border transition-shadow hover:shadow-md"
                  title="Open focus mode"
                >
                  {/* Arbitrary remote URLs and data URLs: next/image cannot help here. */}
                  <img src={mockupSrc} alt={node?.label ?? "Screen mockup"} className="w-full object-contain" />
                </button>
              ) : (
                <div className="rounded-lg border border-dashed bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
                  A browser can&apos;t load a <code className="font-mono">file://</code> path for security
                  reasons. Drop or paste the image here, or use an{" "}
                  <code className="font-mono">https://</code> URL.
                </div>
              )
            ) : null}

            {listArtifacts.map((artifact, index) => (
              <ArtifactView key={`${artifact.kind}-${index}`} artifact={artifact} />
            ))}

            {node && listArtifacts.length === 0 && !mockupSrc && !node.props.desc ? (
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
