import { error, type Diagnostic } from "./diagnostics";
import { EMPTY_SPAN } from "./lexer/tokens";
import { parse } from "./parser/parser";
import { defaultRegistry } from "./schema/registry";
import type { NodeTypeRegistry } from "./schema/types";
import { validate } from "./validate/validate";
import { lower } from "./ir/lower";
import type { DiagramIR, IRNode } from "./ir/ir";

/**
 * Source text to DiagramIR.
 *
 * This function never throws. The input is a textarea being typed into, so a
 * thrown exception means a blank screen mid-keystroke. Every failure — a stray
 * brace, an unknown keyword, an internal bug — comes back as a Diagnostic.
 */
export function compile(
  source: string,
  registry: NodeTypeRegistry = defaultRegistry,
): DiagramIR {
  try {
    const { doc, diagnostics: parseDiagnostics } = parse(source);
    const validationDiagnostics = validate(doc, registry);
    const { nodes, flows } = lower(doc, registry);
    const diagnostics: Diagnostic[] = [...parseDiagnostics, ...validationDiagnostics].sort(
      (a, b) => a.span.start - b.span.start,
    );
    return { version: 1, nodes, flows, diagnostics };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return {
      version: 1,
      nodes: [],
      flows: [],
      diagnostics: [error("internal-error", `Could not read the diagram: ${message}`, EMPTY_SPAN)],
    };
  }
}

export function findNode(ir: DiagramIR, id: string): IRNode | undefined {
  return ir.nodes.find((node) => node.id === id);
}

export function hasErrors(ir: DiagramIR): boolean {
  return ir.diagnostics.some((diagnostic) => diagnostic.severity === "error");
}
