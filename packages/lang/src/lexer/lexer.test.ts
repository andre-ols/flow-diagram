import { describe, expect, it } from "vitest";
import { tokenize } from "./lexer";

const kinds = (src: string) => tokenize(src).map((t) => t.kind);
const values = (src: string) => tokenize(src).map((t) => t.value);

describe("tokenize", () => {
  it("always terminates with a single eof token", () => {
    const tokens = tokenize("");
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.kind).toBe("eof");
  });

  it("lexes a block header", () => {
    expect(kinds('service OrderService "Order Service" {')).toEqual([
      "ident", "ident", "string", "lbrace", "eof",
    ]);
    expect(values('service OrderService "Order Service" {')).toEqual([
      "service", "OrderService", "Order Service", "{", "",
    ]);
  });

  it("records absolute offsets, line and column", () => {
    const [first, second] = tokenize("db\n  Orders");
    expect(first?.span).toEqual({ start: 0, end: 2, line: 1, col: 1 });
    expect(second?.span).toEqual({ start: 5, end: 11, line: 2, col: 3 });
  });

  it("skips # and // comments to end of line", () => {
    expect(kinds("# note\nfoo // trailing\nbar")).toEqual(["ident", "ident", "eof"]);
  });

  it("reads a multi-line template literal and keeps its start line", () => {
    const tokens = tokenize('payload: `{\n  "a": 1\n}`\nnext');
    const template = tokens.find((t) => t.kind === "template");
    expect(template?.value).toBe('{\n  "a": 1\n}');
    expect(template?.span.line).toBe(1);
    // the token after the template must report the correct line
    expect(tokens.at(-2)?.value).toBe("next");
    expect(tokens.at(-2)?.span.line).toBe(4);
  });

  it("distinguishes -> from ref operators", () => {
    expect(kinds("a -> b")).toEqual(["ident", "arrow", "ident", "eof"]);
    expect(values("x.y > z.w")).toEqual(["x", ".", "y", ">", "z", ".", "w", ""]);
    expect(kinds("a <> b")).toEqual(["ident", "refop", "ident", "eof"]);
  });

  it("lexes parenthesised column types", () => {
    expect(kinds("gross decimal(12,2)")).toEqual([
      "ident", "ident", "lparen", "number", "comma", "number", "rparen", "eof",
    ]);
  });

  it("falls back to bareword for unrecognised runs", () => {
    const tokens = tokenize("path: /v1/orders");
    expect(tokens[2]?.kind).toBe("bareword");
    expect(tokens[2]?.value).toBe("/v1/orders");
  });

  it("does not hang on an unterminated string or template", () => {
    expect(kinds('label: "unterminated')).toEqual(["ident", "colon", "string", "eof"]);
    expect(kinds("payload: `unterminated")).toEqual(["ident", "colon", "template", "eof"]);
  });
});
