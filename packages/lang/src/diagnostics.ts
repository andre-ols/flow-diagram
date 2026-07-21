import type { Span } from "./lexer/tokens";

export type DiagnosticSeverity = "error" | "warning";

export type DiagnosticCode =
  | "syntax-error"
  | "unknown-block"
  | "unknown-prop"
  | "missing-required-prop"
  | "missing-id"
  | "duplicate-id"
  | "unresolved-node-ref"
  | "unresolved-table-ref"
  | "empty-flow"
  | "orphan-node"
  | "internal-error";

export interface Diagnostic {
  severity: DiagnosticSeverity;
  code: DiagnosticCode;
  message: string;
  span: Span;
}

export function error(code: DiagnosticCode, message: string, span: Span): Diagnostic {
  return { severity: "error", code, message, span };
}

export function warning(code: DiagnosticCode, message: string, span: Span): Diagnostic {
  return { severity: "warning", code, message, span };
}
