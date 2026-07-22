import type { IRNode } from "@flow/lang";
import type { NodeTypes } from "@xyflow/react";
import { DbNode } from "./db-node";
import { FallbackNode } from "./fallback-node";
import { HttpNode } from "./http-node";
import { ScreenNode } from "./screen-node";
import { ServiceNode } from "./service-node";
import { TopicNode } from "./topic-node";

export interface FlowNodeData extends Record<string, unknown> {
  node: IRNode;
}

/** Must be module-level and stable: React Flow re-mounts nodes otherwise. */
export const nodeTypes = {
  screen: ScreenNode,
  service: ServiceNode,
  http: HttpNode,
  db: DbNode,
  topic: TopicNode,
  fallback: FallbackNode,
} as unknown as NodeTypes;

export function nodeTypeFor(kind: string): string {
  return kind in nodeTypes ? kind : "fallback";
}
