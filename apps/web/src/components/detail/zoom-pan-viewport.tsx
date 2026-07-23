"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Maximize, Minus, Plus } from "lucide-react";
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { Button } from "@/components/ui/button";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * A full-area pan/zoom surface with whiteboard-style trackpad gestures: a
 * two-finger swipe pans, a pinch (which the browser delivers as a ctrl/meta
 * wheel) zooms toward the cursor, and dragging pans too. Content keeps its
 * natural size and is centred on open, so this serves a wide ER diagram or a
 * large screenshot alike. The only place that knows about react-zoom-pan-pinch.
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
  const apiRef = useRef<ReactZoomPanPinchRef | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Mirror of the live transform, kept in sync via onInit/onTransform so the
  // wheel handler can compute the next transform without reading library
  // internals.
  const transform = useRef({ scale: 1, positionX: 0, positionY: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Native, non-passive so we can preventDefault the browser's own zoom/scroll.
    const onWheel = (event: WheelEvent) => {
      const api = apiRef.current;
      if (!api) return;
      event.preventDefault();
      const { scale, positionX, positionY } = transform.current;

      if (event.ctrlKey || event.metaKey) {
        // Pinch-zoom, anchored so the point under the cursor stays put.
        const rect = el.getBoundingClientRect();
        const cursorX = event.clientX - rect.left;
        const cursorY = event.clientY - rect.top;
        const next = clamp(scale * Math.exp(-event.deltaY * 0.0075), minScale, maxScale);
        const worldX = (cursorX - positionX) / scale;
        const worldY = (cursorY - positionY) / scale;
        api.setTransform(cursorX - worldX * next, cursorY - worldY * next, next, 0);
      } else {
        // Two-finger swipe pans, following the gesture 1:1.
        api.setTransform(positionX - event.deltaX, positionY - event.deltaY, scale, 0);
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [minScale, maxScale]);

  return (
    <div ref={containerRef} className="relative h-full w-full select-none overflow-hidden bg-muted/20">
      <TransformWrapper
        ref={apiRef}
        minScale={minScale}
        maxScale={maxScale}
        initialScale={1}
        centerOnInit
        limitToBounds={false}
        wheel={{ disabled: true }}
        doubleClick={{ disabled: true }}
        onInit={(ref) => {
          transform.current = {
            scale: ref.state.scale,
            positionX: ref.state.positionX,
            positionY: ref.state.positionY,
          };
        }}
        onTransform={(_ref, state) => {
          transform.current = state;
        }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <TransformComponent wrapperStyle={{ width: "100%", height: "100%", cursor: "grab" }}>
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
