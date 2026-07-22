"use client";

import { useReactFlow } from "@xyflow/react";
import { LayoutGrid, Maximize2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useStudioStore } from "@/store/studio-store";

export function CanvasControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const resetLayout = useStudioStore((state) => state.resetLayout);

  return (
    <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1 rounded-lg border bg-card p-1 shadow-md">
      <Button variant="ghost" size="icon" className="size-7" onClick={() => zoomOut()} aria-label="Zoom out">
        <Minus className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" className="size-7" onClick={() => zoomIn()} aria-label="Zoom in">
        <Plus className="size-4" />
      </Button>
      <Separator orientation="vertical" className="mx-1 h-4" />
      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => fitView({ padding: 0.2 })}>
        <Maximize2 className="mr-1 size-3.5" />
        Fit
      </Button>
      <Separator orientation="vertical" className="mx-1 h-4" />
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => {
          resetLayout();
          window.requestAnimationFrame(() => fitView({ padding: 0.2 }));
        }}
      >
        <LayoutGrid className="mr-1 size-3.5" />
        Re-layout
      </Button>
    </div>
  );
}
