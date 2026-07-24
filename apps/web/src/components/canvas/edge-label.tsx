"use client";

import { EdgeLabelRenderer } from "@xyflow/react";
import type { ReactNode } from "react";

export interface EdgeLabelProps {
  labelX: number;
  labelY: number;
  label?: string | ReactNode;
  executionOrder?: number;
}

export function EdgeLabel({ labelX, labelY, label, executionOrder }: EdgeLabelProps) {
  if (!label && executionOrder === undefined) return null;

  return (
    <EdgeLabelRenderer>
      <div
        style={{
          position: "absolute",
          transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          pointerEvents: "all",
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
        className="nodrag nopan"
      >
        {executionOrder !== undefined && (
          <div
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
