import type { Diagnostic } from "@flow/lang";
import { linter, type Diagnostic as CmDiagnostic } from "@codemirror/lint";
import type { Extension } from "@codemirror/state";

/**
 * Diagnostics are produced from a debounced compile, so they can briefly
 * describe a document longer than the one on screen. Clamping is what stops
 * CodeMirror throwing a range error after a select-all-and-delete.
 */
export function toCodeMirrorDiagnostics(
  diagnostics: Diagnostic[],
  docLength: number,
): CmDiagnostic[] {
  return diagnostics.map((diagnostic) => {
    const from = Math.max(0, Math.min(diagnostic.span.start, docLength));
    const rawTo = Math.max(from, Math.min(diagnostic.span.end, docLength));
    const to = rawTo === from ? Math.min(from + 1, docLength) : rawTo;
    return {
      from,
      to,
      severity: diagnostic.severity,
      message: diagnostic.message,
      source: diagnostic.code,
    };
  });
}

export function flowLinter(getDiagnostics: () => Diagnostic[]): Extension {
  return linter(
    (view) => toCodeMirrorDiagnostics(getDiagnostics(), view.state.doc.length),
    // Slightly longer than the store's compile debounce, so the underlines the
    // user sees always match the diagnostics the store currently holds.
    { delay: 250 },
  );
}
