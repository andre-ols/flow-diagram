import dagre from "@dagrejs/dagre";
import type { ErModelArtifact } from "@flow/lang";
import type { LayoutResult, Point } from "./flow-layout";

export const ER_TABLE_WIDTH = 250;
export const ER_HEADER_HEIGHT = 36;
export const ER_ROW_HEIGHT = 26;
const MARGIN = 24;

export function erTableHeight(fieldCount: number): number {
  return ER_HEADER_HEIGHT + fieldCount * ER_ROW_HEIGHT;
}

export function layoutErModel(model: ErModelArtifact): LayoutResult {
  if (model.tables.length === 0) return { positions: {}, width: 0, height: 0 };

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "LR", nodesep: 32, ranksep: 80, marginx: MARGIN, marginy: MARGIN });
  graph.setDefaultEdgeLabel(() => ({}));

  const heights = new Map<string, number>();
  for (const table of model.tables) {
    const height = erTableHeight(table.fields.length);
    heights.set(table.name, height);
    graph.setNode(table.name, { width: ER_TABLE_WIDTH, height });
  }
  for (const ref of model.refs) {
    if (heights.has(ref.fromTable) && heights.has(ref.toTable)) {
      graph.setEdge(ref.fromTable, ref.toTable);
    }
  }

  dagre.layout(graph);

  const positions: Record<string, Point> = {};
  let width = 0;
  let height = 0;

  for (const id of graph.nodes()) {
    const laid = graph.node(id) as { x: number; y: number } | undefined;
    if (!laid) continue;
    const tableHeight = heights.get(id) ?? ER_HEADER_HEIGHT;
    const point: Point = { x: laid.x - ER_TABLE_WIDTH / 2, y: laid.y - tableHeight / 2 };
    positions[id] = point;
    width = Math.max(width, point.x + ER_TABLE_WIDTH + MARGIN);
    height = Math.max(height, point.y + tableHeight + MARGIN);
  }

  return { positions, width, height };
}
