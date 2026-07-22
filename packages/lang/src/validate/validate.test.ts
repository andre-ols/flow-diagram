import { describe, expect, it } from "vitest";
import { parse } from "../parser/parser";
import { defaultRegistry } from "../schema/registry";
import { validate } from "./validate";

const check = (src: string) => validate(parse(src).doc, defaultRegistry);
const codes = (src: string) => check(src).map((d) => d.code);

/** The exact text a diagnostic points at — this is what the editor underlines. */
const underlined = (src: string, code: string) => {
  const diagnostic = check(src).find((d) => d.code === code);
  if (!diagnostic) throw new Error(`no ${code} diagnostic in:\n${src}`);
  return src.slice(diagnostic.span.start, diagnostic.span.end);
};

const VALID = [
  'screen S "Orders" {\n  desc: "x"\n}',
  "http H {\n  method: GET\n  path: /x\n}",
  'flow F "Flow" {\n  S -> H\n}',
].join("\n\n");

describe("validate", () => {
  it("accepts a well-formed document", () => {
    expect(check(VALID)).toEqual([]);
  });

  it("flags an unknown block keyword and underlines the keyword", () => {
    const src = 'lambda L {\n  desc: "x"\n}';
    expect(codes(src)).toContain("unknown-block");
    expect(underlined(src, "unknown-block")).toBe("lambda");
  });

  it("flags an unknown property and underlines the property name", () => {
    const src = 'service S {\n  colour: "red"\n}';
    expect(underlined(src, "unknown-prop")).toBe("colour");
  });

  it("treats an unknown property as a warning, not an error", () => {
    expect(check('service S {\n  colour: "red"\n}')[0]?.severity).toBe("warning");
  });

  it("flags a missing required property and names it", () => {
    const src = "http H {\n  path: /x\n}";
    expect(codes(src)).toContain("missing-required-prop");
    const diagnostic = check(src).find((d) => d.code === "missing-required-prop");
    expect(diagnostic?.message).toContain("method");
  });

  it("flags an invalid enum value", () => {
    expect(codes("http H {\n  method: FETCH\n  path: /x\n}")).toContain("unknown-prop");
  });

  it("accepts a lower-case enum value", () => {
    expect(codes("http H {\n  method: get\n  path: /x\n}")).toEqual([]);
  });

  it("flags a duplicate id on its second occurrence", () => {
    const src = "service A {}\nservice A {}";
    const diagnostic = check(src).find((d) => d.code === "duplicate-id");
    expect(diagnostic?.span.line).toBe(2);
  });

  it("flags a flow edge pointing at an undeclared node", () => {
    const src = "service A {}\nflow F {\n  A -> Ghost\n}";
    expect(underlined(src, "unresolved-node-ref")).toBe("Ghost");
  });

  it("flags a ref pointing at a missing table", () => {
    const src = "db D {\n  table t {\n    id bigint [pk]\n  }\n  ref: t.id > ghost.id\n}";
    expect(codes(src)).toContain("unresolved-table-ref");
  });

  it("flags a ref pointing at a missing column", () => {
    const src = "db D {\n  table t {\n    id bigint [pk]\n  }\n  ref: t.nope > t.id\n}";
    expect(codes(src)).toContain("unresolved-table-ref");
  });

  it("flags a nameless table inside a db block", () => {
    const src = "db D {\n  table {\n    id bigint [pk]\n  }\n}";
    expect(codes(src)).toContain("missing-id");
    expect(underlined(src, "missing-id")).toBe("table");
  });

  it("accepts a valid ref", () => {
    const src =
      "db D {\n  table t {\n    id bigint [pk]\n    other bigint [fk]\n  }\n" +
      "  ref: t.other > t.id\n}\nflow F {\n  D -> D\n}";
    expect(codes(src)).toEqual([]);
  });

  it("warns about an empty flow", () => {
    expect(codes("service A {}\nflow F {}")).toContain("empty-flow");
  });

  it("warns about a node that appears in no flow", () => {
    expect(codes("service A {}\nservice B {}\nflow F {\n  A -> A\n}")).toContain("orphan-node");
  });

  it("does not warn about orphans when the document declares no flows", () => {
    expect(codes("service A {}")).not.toContain("orphan-node");
  });

  it("flags a field statement inside a properties-mode block", () => {
    expect(codes("service S {\n  id bigint\n}")).toContain("unknown-prop");
  });

  it("flags an unknown nested block", () => {
    expect(codes("http H {\n  method: GET\n  path: /x\n  headers {}\n}")).toContain(
      "unknown-block",
    );
  });

  it("flags a second response block", () => {
    const src = "http H {\n  method: GET\n  path: /x\n  response {}\n  response {}\n}";
    expect(codes(src)).toContain("unknown-block");
  });

  it("flags a connection written outside a flow block", () => {
    expect(codes("service A {\n  A -> A\n}")).toContain("unknown-block");
  });

  it("returns diagnostics sorted by source position", () => {
    const diagnostics = check('service S {\n  colour: "x"\n}\nlambda L {}');
    const starts = diagnostics.map((d) => d.span.start);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });
});
