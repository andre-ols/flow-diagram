"use client";

import { useCallback, type ClipboardEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { kindMeta } from "@/lib/kind-styles";
import { selectDisplayIr, useStudioStore } from "@/store/studio-store";
import { ArtifactView } from "./artifact-renderers";

export function NodeDetailDialog() {
  const ir = useStudioStore(selectDisplayIr);
  const selectedNodeId = useStudioStore((state) => state.selectedNodeId);
  const selectNode = useStudioStore((state) => state.selectNode);
  const setScreenImage = useStudioStore((state) => state.setScreenImage);

  const node = selectedNodeId ? ir.nodes.find((candidate) => candidate.id === selectedNodeId) : undefined;

  const onPaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      if (!node || node.kind !== "screen") return;
      const file = Array.from(event.clipboardData.files)[0];
      if (!file || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") setScreenImage(node.id, reader.result);
      };
      reader.readAsDataURL(file);
    },
    [node, setScreenImage],
  );

  const meta = kindMeta(node?.kind ?? "");

  return (
    <Dialog open={Boolean(node)} onOpenChange={(open) => !open && selectNode(null)}>
      <DialogContent className="max-h-[86vh] max-w-3xl gap-0 overflow-hidden p-0" onPaste={onPaste}>
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

            {node?.artifacts.map((artifact, index) => (
              <ArtifactView key={`${artifact.kind}-${index}`} artifact={artifact} />
            ))}

            {node && node.artifacts.length === 0 && !node.props.desc ? (
              <p className="text-sm text-muted-foreground">
                No details yet. Add properties to this component in the editor.
              </p>
            ) : null}

            {node?.kind === "screen" ? (
              <p className="text-xs text-muted-foreground">
                Paste an image here to attach a mockup, or set{" "}
                <code className="font-mono">image: &quot;https://…&quot;</code> in the editor.
              </p>
            ) : null}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
