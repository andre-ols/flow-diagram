import dagre from "@dagrejs/dagre";
import type { DiagramIR } from "@flow/lang";

export interface NodeSize {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface LayoutResult {
  /** Top-left corner of each node, keyed by node id. */
  positions: Record<string, Point>;
  width: number;
  height: number;
}

/**
 * Card dimensions by kind. Only kinds whose card differs from the norm need an
 * entry: `screen` is taller because it shows a mockup thumbnail. Every other
 * kind — including any not-yet-known kind — falls back to `default` via
 * `sizeOf`, so this is deliberately not derived from the node registry.
 */
export const NODE_SIZE: Record<string, NodeSize> = {
  screen: { width: 260, height: 188 },
  default: { width: 260, height: 116 },
};

const MARGIN = 40;

export function sizeOf(kind: string): NodeSize {
  return NODE_SIZE[kind] ?? (NODE_SIZE.default as NodeSize);
}

export function layoutFlow(ir: DiagramIR, flowId: string): LayoutResult {
  const flow = ir.flows.find((candidate) => candidate.id === flowId);
  if (!flow) return { positions: {}, width: 0, height: 0 };

  const touched = new Set<string>();
  for (const edge of flow.edges) {
    touched.add(edge.from);
    touched.add(edge.to);
  }
  const nodes = ir.nodes.filter((node) => touched.has(node.id));
  if (nodes.length === 0) return { positions: {}, width: 0, height: 0 };

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "LR", nodesep: 48, ranksep: 96, marginx: MARGIN, marginy: MARGIN });
  graph.setDefaultEdgeLabel(() => ({}));

  const kinds = new Map(nodes.map((node) => [node.id, node.kind]));
  for (const node of nodes) graph.setNode(node.id, { ...sizeOf(node.kind) });
  for (const edge of flow.edges) {
    if (kinds.has(edge.from) && kinds.has(edge.to)) graph.setEdge(edge.from, edge.to);
  }

  dagre.layout(graph);

  const positions: Record<string, Point> = {};
  let width = 0;
  let height = 0;

  for (const id of graph.nodes()) {
    const laid = graph.node(id) as { x: number; y: number } | undefined;
    if (!laid) continue;
    const size = sizeOf(kinds.get(id) ?? "default");
    // dagre reports centres; every consumer wants a top-left corner.
    const point: Point = { x: laid.x - size.width / 2, y: laid.y - size.height / 2 };
    positions[id] = point;
    width = Math.max(width, point.x + size.width + MARGIN);
    height = Math.max(height, point.y + size.height + MARGIN);
  }

  return { positions, width, height };
}
