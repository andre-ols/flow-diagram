import type { AstDocument } from "../parser/ast";
import { FLOW_KEYWORD } from "../schema/registry";
import type { NodeTypeRegistry } from "../schema/types";
import type { IREdge, IRFlow, IRNode } from "./ir";

export function lower(
  doc: AstDocument,
  registry: NodeTypeRegistry,
): { nodes: IRNode[]; flows: IRFlow[] } {
  const nodes: IRNode[] = [];
  const seen = new Set<string>();

  for (const block of doc.blocks) {
    if (block.keyword === FLOW_KEYWORD) continue;
    const def = registry.get(block.keyword);
    // Unknown kinds and duplicates are reported by validate(); here they are
    // simply skipped so the rest of the diagram still renders.
    if (!def || !block.id || seen.has(block.id)) continue;
    seen.add(block.id);

    const props: Record<string, string> = {};
    for (const entry of block.entries) {
      if (entry.type === "property") props[entry.name] = entry.value;
    }

    nodes.push({
      id: block.id,
      kind: def.keyword,
      label: block.label ?? block.id,
      props,
      artifacts: def.toArtifacts(block),
      span: block.span,
    });
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const flows: IRFlow[] = [];
  const seenFlows = new Set<string>();

  for (const block of doc.blocks) {
    if (block.keyword !== FLOW_KEYWORD || !block.id || seenFlows.has(block.id)) continue;
    seenFlows.add(block.id);
    const edges: IREdge[] = [];

    for (const entry of block.entries) {
      if (entry.type !== "edge") continue;
      for (let i = 0; i < entry.hops.length - 1; i += 1) {
        const from = entry.hops[i];
        const to = entry.hops[i + 1];
        if (!from || !to) continue;
        if (!nodeIds.has(from.name) || !nodeIds.has(to.name)) continue;
        edges.push({
          from: from.name,
          to: to.name,
          label: i === entry.hops.length - 2 ? (entry.label ?? undefined) : undefined,
          span: entry.span,
        });
      }
    }

    flows.push({ id: block.id, label: block.label ?? block.id, edges });
  }

  return { nodes, flows };
}
