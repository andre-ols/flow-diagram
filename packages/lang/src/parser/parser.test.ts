import { describe, expect, it } from "vitest";
import { parse } from "./parser";
import type { AstBlock, AstEdge, AstField, AstProperty, AstRef } from "./ast";

const firstBlock = (src: string): AstBlock => {
  const block = parse(src).doc.blocks[0];
  if (!block) throw new Error("expected at least one block");
  return block;
};

describe("parse — block headers", () => {
  it("reads keyword, id and label", () => {
    const block = firstBlock('service OrderService "Order Service" {}');
    expect(block.keyword).toBe("service");
    expect(block.id).toBe("OrderService");
    expect(block.label).toBe("Order Service");
  });

  it("treats a missing label as null", () => {
    expect(firstBlock("service OrderService {}").label).toBeNull();
  });

  it("reports a missing id without dropping the block", () => {
    const { doc, diagnostics } = parse("service {}");
    expect(doc.blocks).toHaveLength(1);
    expect(diagnostics.map((d) => d.code)).toContain("missing-id");
  });
});

describe("parse — properties", () => {
  it("reads quoted, template and bare values", () => {
    const entries = firstBlock(
      'http X {\n  desc: "Lists orders"\n  payload: `{"a":1}`\n  path: /v1/orders\n}',
    ).entries as AstProperty[];
    expect(entries.map((e) => [e.name, e.value, e.valueKind])).toEqual([
      ["desc", "Lists orders", "string"],
      ["payload", '{"a":1}', "template"],
      ["path", "/v1/orders", "bare"],
    ]);
  });

  it("keeps a bare value on one line and out of the closing brace", () => {
    const entries = firstBlock("service S {\n  external: true\n}").entries as AstProperty[];
    expect(entries[0]?.value).toBe("true");
  });

  it("spans a property name precisely enough to underline it", () => {
    const entry = firstBlock("service S {\n  desc: \"x\"\n}").entries[0] as AstProperty;
    expect(entry.nameSpan.line).toBe(2);
    expect(entry.nameSpan.col).toBe(3);
  });
});

describe("parse — nested blocks", () => {
  it("nests request and response inside http", () => {
    const block = firstBlock(
      "http X {\n  request {\n    payload: `{}`\n  }\n  response {\n    status: 200\n  }\n}",
    );
    const nested = block.entries.filter((e) => e.type === "block");
    expect(nested).toHaveLength(2);
    expect(nested.map((e) => e.block.keyword)).toEqual(["request", "response"]);
  });

  it("nests table blocks with a header id inside db", () => {
    const block = firstBlock("db D {\n  table order {\n    id bigint [pk]\n  }\n}");
    const table = block.entries[0];
    if (table?.type !== "block") throw new Error("expected nested block");
    expect(table.block.keyword).toBe("table");
    expect(table.block.id).toBe("order");
  });
});

describe("parse — fields", () => {
  it("reads name, type and flags", () => {
    const block = firstBlock(
      "db D {\n  table t {\n    id bigint [pk]\n    total decimal(12,2)\n    name varchar(244) [not null]\n  }\n}",
    );
    const table = block.entries[0];
    if (table?.type !== "block") throw new Error("expected nested block");
    const fields = table.block.entries as AstField[];
    expect(fields.map((f) => [f.name, f.fieldType, f.flags])).toEqual([
      ["id", "bigint", ["pk"]],
      ["total", "decimal(12,2)", []],
      ["name", "varchar(244)", ["not null"]],
    ]);
  });

  it("reads multiple comma-separated flags", () => {
    const block = firstBlock("db D {\n  table t {\n    c bigint [pk, not null]\n  }\n}");
    const table = block.entries[0];
    if (table?.type !== "block") throw new Error("expected nested block");
    expect((table.block.entries[0] as AstField).flags).toEqual(["pk", "not null"]);
  });
});

describe("parse — edges and refs", () => {
  it("expands a multi-hop edge into pairs and attaches the label to the last hop", () => {
    const block = firstBlock('flow F {\n  A -> B -> C : "sends"\n}');
    const edge = block.entries[0] as AstEdge;
    expect(edge.hops.map((h) => h.name)).toEqual(["A", "B", "C"]);
    expect(edge.label).toBe("sends");
  });

  it("reads a ref with its operator", () => {
    const block = firstBlock("db D {\n  ref: order.campaign_id > campaign.id\n}");
    const ref = block.entries[0] as AstRef;
    expect(ref.from).toMatchObject({ table: "order", column: "campaign_id" });
    expect(ref.to).toMatchObject({ table: "campaign", column: "id" });
    expect(ref.op).toBe(">");
  });
});

describe("parse — error recovery", () => {
  it("keeps parsing blocks after a broken one", () => {
    const { doc, diagnostics } = parse("service A { !!! }\nservice B {}");
    expect(doc.blocks.map((b) => b.id)).toEqual(["A", "B"]);
    expect(diagnostics.some((d) => d.code === "syntax-error")).toBe(true);
  });

  it("recovers from a block missing its opening brace", () => {
    const { doc } = parse("service A\nservice B {}");
    expect(doc.blocks.map((b) => b.id)).toContain("B");
  });

  it("does not hang on an unclosed block", () => {
    const { doc, diagnostics } = parse("service A {\n  desc: \"x\"\n");
    expect(doc.blocks).toHaveLength(1);
    expect(diagnostics.some((d) => d.code === "syntax-error")).toBe(true);
  });

  it("reports stray top-level tokens without dropping later blocks", () => {
    const { doc, diagnostics } = parse("}}}\nservice B {}");
    expect(doc.blocks.map((b) => b.id)).toEqual(["B"]);
    expect(diagnostics.some((d) => d.code === "syntax-error")).toBe(true);
  });
});
