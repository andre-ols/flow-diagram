"use client";

import { compile, type DiagramIR } from "@flow/lang";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SAMPLE_DIAGRAM } from "@/lib/sample-diagram";

export interface Point {
  x: number;
  y: number;
}

export const STORAGE_KEY = "flow-diagram-studio";

/**
 * Whether an IR is worth drawing. Warnings and unresolved references are fine —
 * a half-written diagram is still useful. Only a structurally broken parse is
 * not, and that is the case that makes the canvas blank mid-keystroke.
 */
export function isRenderable(ir: DiagramIR): boolean {
  if (ir.nodes.length === 0 || ir.flows.length === 0) return false;
  return !ir.diagnostics.some(
    (diagnostic) => diagnostic.code === "syntax-error" || diagnostic.code === "internal-error",
  );
}

export interface StudioState {
  source: string;
  /** Compiled from the current source, warts and all. Drives the editor gutter. */
  ir: DiagramIR;
  /** The most recent renderable IR. Drives the canvas when `ir` is unusable. */
  lastValidIr: DiagramIR;
  activeFlowId: string | null;
  selectedNodeId: string | null;
  manualPositions: Record<string, Point>;
  /** Pasted mockups, keyed by node id. Deliberately not part of the DSL text. */
  screenImages: Record<string, string>;

  setSource: (source: string) => void;
  setActiveFlow: (flowId: string) => void;
  selectNode: (nodeId: string | null) => void;
  setNodePosition: (nodeId: string, position: Point) => void;
  resetLayout: () => void;
  setScreenImage: (nodeId: string, dataUrl: string) => void;
}

const initialIr = compile(SAMPLE_DIAGRAM);

export const useStudioStore = create<StudioState>()(
  persist(
    (set) => ({
      source: SAMPLE_DIAGRAM,
      ir: initialIr,
      lastValidIr: initialIr,
      activeFlowId: initialIr.flows[0]?.id ?? null,
      selectedNodeId: null,
      manualPositions: {},
      screenImages: {},

      setSource: (source) =>
        set((state) => {
          const ir = compile(source);
          const renderable = isRenderable(ir);
          const lastValidIr = renderable ? ir : state.lastValidIr;
          const display = renderable ? ir : lastValidIr;
          const activeFlowId = display.flows.some((flow) => flow.id === state.activeFlowId)
            ? state.activeFlowId
            : (display.flows[0]?.id ?? null);
          return { source, ir, lastValidIr, activeFlowId };
        }),

      setActiveFlow: (flowId) => set({ activeFlowId: flowId, selectedNodeId: null }),

      selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

      setNodePosition: (nodeId, position) =>
        set((state) => ({ manualPositions: { ...state.manualPositions, [nodeId]: position } })),

      resetLayout: () => set({ manualPositions: {} }),

      setScreenImage: (nodeId, dataUrl) =>
        set((state) => ({ screenImages: { ...state.screenImages, [nodeId]: dataUrl } })),
    }),
    {
      name: STORAGE_KEY,
      // The IR is derived, so it is never persisted — it is recomputed on load.
      partialize: (state) => ({
        source: state.source,
        activeFlowId: state.activeFlowId,
        manualPositions: state.manualPositions,
        screenImages: state.screenImages,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setSource(state.source);
      },
    },
  ),
);

export function selectDisplayIr(state: StudioState): DiagramIR {
  return isRenderable(state.ir) ? state.ir : state.lastValidIr;
}

export function selectIsStale(state: StudioState): boolean {
  return !isRenderable(state.ir) && isRenderable(state.lastValidIr);
}
