"use client";

import { BaseEdge, getSmoothStepPath, type Edge, type EdgeProps } from "@xyflow/react";

export interface LoopEdgeData extends Record<string, unknown> {
  /** Bottom-most y (in flow coordinates) reached by any card in the diagram. */
  maxBottom: number;
}

export type LoopEdge = Edge<LoopEdgeData>;

/** Clearance kept between a looped-back edge and the lowest card on the canvas. */
const LOOP_CLEARANCE = 32;

/**
 * Smoothstep edge whose backward leg (target sitting left of source — e.g. a
 * call returning to its caller) is routed below every card on the canvas.
 * React Flow's default smoothstep instead bends at the vertical midpoint of
 * the two handles, which cuts straight through whichever card sits between
 * source and target. Forward edges are unaffected: they render identically
 * to the built-in smoothstep edge.
 */
export function LoopEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  labelStyle,
  labelBgStyle,
  style,
  markerEnd,
  markerStart,
  data,
}: EdgeProps<LoopEdge>) {
  const isBackward = targetX < sourceX;

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    ...(isBackward && data ? { centerY: data.maxBottom + LOOP_CLEARANCE } : {}),
  });

  return (
    <BaseEdge
      id={id}
      path={path}
      labelX={labelX}
      labelY={labelY}
      label={label}
      labelStyle={labelStyle}
      labelBgStyle={labelBgStyle}
      style={style}
      markerEnd={markerEnd}
      markerStart={markerStart}
    />
  );
}
