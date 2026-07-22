import { describe, expect, it } from "vitest";
import { compile } from "@flow/lang";
import { toCodeMirrorDiagnostics } from "./flow-linter";

describe("toCodeMirrorDiagnostics", () => {
  it("maps a diagnostic onto the characters that caused it", () => {
    const source = "lambda L {}";
    const [mapped] = toCodeMirrorDiagnostics(compile(source).diagnostics, source.length);
    expect(source.slice(mapped!.from, mapped!.to)).toBe("lambda");
  });

  it("carries the severity and the diagnostic code through", () => {
    const source = 'service S {\n  colour: "x"\n}';
    const [mapped] = toCodeMirrorDiagnostics(compile(source).diagnostics, source.length);
    expect(mapped?.severity).toBe("warning");
    expect(mapped?.source).toBe("unknown-prop");
  });

  it("clamps spans that fall outside a document that has since shrunk", () => {
    const diagnostics = compile("lambda LongName {}").diagnostics;
    for (const mapped of toCodeMirrorDiagnostics(diagnostics, 3)) {
      expect(mapped.from).toBeGreaterThanOrEqual(0);
      expect(mapped.to).toBeLessThanOrEqual(3);
      expect(mapped.from).toBeLessThanOrEqual(mapped.to);
    }
  });

  it("widens a zero-width span so it is still visible", () => {
    const mapped = toCodeMirrorDiagnostics(
      [{ severity: "error", code: "syntax-error", message: "x", span: { start: 2, end: 2, line: 1, col: 3 } }],
      10,
    );
    expect(mapped[0]?.to).toBeGreaterThan(mapped[0]!.from);
  });

  it("drops nothing and returns one entry per diagnostic", () => {
    const source = 'service S {\n  colour: "x"\n}\nlambda L {}';
    const diagnostics = compile(source).diagnostics;
    expect(toCodeMirrorDiagnostics(diagnostics, source.length)).toHaveLength(diagnostics.length);
  });
});
