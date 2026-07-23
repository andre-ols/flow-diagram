"use client";

import { useCallback, type ClipboardEvent, type DragEvent } from "react";
import type { ErModelArtifact } from "@flow/lang";
import { Minimize2 } from "lucide-react";
import { LabelChip } from "@/components/label-chip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { firstImageFile, isDisplayableImageSrc, readImageFileAsDataUrl } from "@/lib/image-io";
import { kindMeta } from "@/lib/kind-styles";
import { selectDisplayIr, useStudioStore } from "@/store/studio-store";
import { ArtifactView } from "./artifact-renderers";
import { ErModelDiagram } from "./er-model-view";
import { ZoomPanViewport } from "./zoom-pan-viewport";

/**
 * Full-screen focus mode for a selected card. db models and screenshots open in
 * a pan/zoom surface; everything else falls back to a scrollable detail sheet
 * that scrolls in both directions. Close with Esc (handled by the dialog) or the
 * minimise button in the top-right.
 */
export function NodeFocusMode() {
  const ir = useStudioStore(selectDisplayIr);
  const focusNodeId = useStudioStore((state) => state.focusNodeId);
  const exitFocus = useStudioStore((state) => state.exitFocus);
  const setScreenImage = useStudioStore((state) => state.setScreenImage);

  const node = focusNodeId ? ir.nodes.find((candidate) => candidate.id === focusNodeId) : undefined;
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
  // mockup, and its image artifact is rendered here rather than in the list.
  const mockupSrc = node?.kind === "screen" ? (node.props.image ?? pasted) : undefined;
  const erModel = node?.artifacts.find((artifact): artifact is ErModelArtifact => artifact.kind === "er-model");
  const detailArtifacts =
    node?.artifacts.filter((artifact) => artifact.kind !== "image" && artifact.kind !== "er-model") ?? [];

  return (
    <Dialog open={Boolean(node)} onOpenChange={(open) => !open && exitFocus()}>
      <DialogContent
        showCloseButton={false}
        className="flex h-screen w-screen max-w-none flex-col gap-0 rounded-none border-0 p-0 sm:max-w-none"
        onPaste={onPaste}
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <header className="flex shrink-0 items-center gap-3 border-b px-5 py-3">
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
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => exitFocus()}
            aria-label="Minimise"
            title="Minimise (Esc)"
          >
            <Minimize2 />
          </Button>
        </header>

        <div className="relative min-h-0 flex-1">
          {mockupSrc ? (
            isDisplayableImageSrc(mockupSrc) ? (
              <ZoomPanViewport>
                <img
                  src={mockupSrc}
                  alt={node?.label ?? "Screen mockup"}
                  draggable={false}
                  className="max-h-[86vh] max-w-[92vw] object-contain"
                />
              </ZoomPanViewport>
            ) : (
              <FileUrlNotice />
            )
          ) : erModel ? (
            <ZoomPanViewport>
              <ErModelDiagram artifact={erModel} />
            </ZoomPanViewport>
          ) : (
            <ScrollableDetail
              desc={node?.props.desc}
              artifacts={detailArtifacts}
              isScreen={node?.kind === "screen"}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScrollableDetail({
  desc,
  artifacts,
  isScreen,
}: {
  desc?: string;
  artifacts: Parameters<typeof ArtifactView>[0]["artifact"][];
  isScreen: boolean;
}) {
  const empty = artifacts.length === 0 && !desc;
  return (
    <div className="h-full w-full overflow-auto">
      <div className="mx-auto max-w-4xl space-y-5 px-6 py-6">
        {desc ? <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p> : null}

        {artifacts.map((artifact, index) => (
          <ArtifactView key={`${artifact.kind}-${index}`} artifact={artifact} />
        ))}

        {isScreen ? (
          <p className="text-xs text-muted-foreground">
            Drop or paste an image here to attach a mockup, or set{" "}
            <code className="font-mono">image: &quot;https://…&quot;</code> in the editor.
          </p>
        ) : empty ? (
          <p className="text-sm text-muted-foreground">
            No details yet. Add properties to this component in the editor.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function FileUrlNotice() {
  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <div className="max-w-md rounded-lg border border-dashed bg-muted/40 px-6 py-8 text-center text-sm text-muted-foreground">
        A browser can&apos;t load a <code className="font-mono">file://</code> path for security reasons.
        Drop or paste the image here, or use an <code className="font-mono">https://</code> URL.
      </div>
    </div>
  );
}
