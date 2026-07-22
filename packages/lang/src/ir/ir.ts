import type { Diagnostic } from "../diagnostics";
import type { Span } from "../lexer/tokens";
import type { Artifact } from "./artifacts";

export interface IRNode {
  id: string;
  /** Registry keyword: screen | service | http | db | topic | future kinds. */
  kind: string;
  label: string;
  /** Scalar properties exactly as written, keyed by name. */
  props: Record<string, string>;
  artifacts: Artifact[];
  span: Span;
}

export interface IREdge {
  from: string;
  to: string;
  label?: string;
  span: Span;
}

export interface IRFlow {
  id: string;
  label: string;
  edges: IREdge[];
}

export interface DiagramIR {
  version: 1;
  nodes: IRNode[];
  flows: IRFlow[];
  diagnostics: Diagnostic[];
}

export const EMPTY_IR: DiagramIR = { version: 1, nodes: [], flows: [], diagnostics: [] };
