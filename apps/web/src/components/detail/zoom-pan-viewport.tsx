"use client";

import type { ReactNode } from "react";
import { Maximize, Minus, Plus } from "lucide-react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { Button } from "@/components/ui/button";

/**
 * A full-area pan/zoom surface: drag to pan, wheel to zoom, plus a control
 * cluster for zoom in/out and fit-to-content. Content keeps its natural size
 * and is centred on open, so this works the same for a wide ER diagram or a
 * large screenshot. The only place that knows about react-zoom-pan-pinch.
 */
export function ZoomPanViewport({
  children,
  minScale = 0.2,
  maxScale = 8,
}: {
  children: ReactNode;
  minScale?: number;
  maxScale?: number;
}) {
  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-muted/20">
      <TransformWrapper
        minScale={minScale}
        maxScale={maxScale}
        initialScale={1}
        centerOnInit
        limitToBounds={false}
        wheel={{ step: 0.05 }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <TransformComponent
              wrapperStyle={{ width: "100%", height: "100%", cursor: "grab" }}
            >
              {children}
            </TransformComponent>
            <div className="absolute bottom-4 right-4 flex flex-col overflow-hidden rounded-lg border bg-card/90 shadow-sm backdrop-blur">
              <Button variant="ghost" size="icon-sm" onClick={() => zoomIn()} aria-label="Zoom in" title="Zoom in">
                <Plus />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => zoomOut()} aria-label="Zoom out" title="Zoom out">
                <Minus />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => resetTransform()}
                aria-label="Fit to view"
                title="Fit to view"
              >
                <Maximize />
              </Button>
            </div>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}
