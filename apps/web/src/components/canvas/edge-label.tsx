"use client";

import { EdgeLabelRenderer } from "@xyflow/react";
import type { ReactNode } from "react";

export interface EdgeLabelProps {
  edgeId: string;
  labelX: number;
  labelY: number;
  label?: string | ReactNode;
  executionOrder?: number;
}

export function EdgeLabel({ edgeId, labelX, labelY, label, executionOrder }: EdgeLabelProps) {
  if (!label && executionOrder === undefined) return null;

  return (
    <EdgeLabelRenderer>
      <div
        data-edge-id={edgeId}
        className="canvas-edge-label nodrag nopan"
        style={{
          position: "absolute",
          transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          pointerEvents: "all",
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        {executionOrder !== undefined && (
          <div
            className="edge-label-circle"
            style={{
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              backgroundColor: "var(--edge)",
              color: "var(--background)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "10px",
              fontWeight: "bold",
            }}
          >
            {executionOrder}
          </div>
        )}
        {label && (
          <div
            style={{
              backgroundColor: "var(--card)",
              color: "var(--foreground)",
              padding: "2px 6px",
              borderRadius: "4px",
              fontSize: "10.5px",
              fontWeight: 600,
            }}
          >
            {label}
          </div>
        )}
      </div>
    </EdgeLabelRenderer>
  );
}
