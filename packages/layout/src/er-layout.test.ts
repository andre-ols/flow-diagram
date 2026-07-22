import { describe, expect, it } from "vitest";
import { compile } from "@flow/lang";
import type { ErModelArtifact } from "@flow/lang";
import { ER_TABLE_WIDTH, erTableHeight, layoutErModel } from "./er-layout";

const model = (): ErModelArtifact => {
  const ir = compile(
    "db D {\n" +
      "  table campaign {\n    id bigint [pk]\n    name varchar(244)\n  }\n" +
      "  table order {\n    id bigint [pk]\n    campaign_id bigint [fk]\n  }\n" +
      "  ref: order.campaign_id > campaign.id\n}",
  );
  return ir.nodes[0]?.artifacts[0] as ErModelArtifact;
};

describe("layoutErModel", () => {
  it("positions every table", () => {
    expect(Object.keys(layoutErModel(model()).positions).sort()).toEqual(["campaign", "order"]);
  });

  it("puts the referenced table downstream of the referencing one", () => {
    const { positions } = layoutErModel(model());
    expect(positions.order!.x).toBeLessThan(positions.campaign!.x);
  });

  it("sizes a table by its field count", () => {
    expect(erTableHeight(2)).toBeLessThan(erTableHeight(5));
  });

  it("returns an empty result for a model with no tables", () => {
    expect(layoutErModel({ kind: "er-model", tables: [], refs: [] })).toEqual({
      positions: {},
      width: 0,
      height: 0,
    });
  });

  it("lays out tables that have no refs at all", () => {
    const result = layoutErModel({
      kind: "er-model",
      tables: [
        { name: "a", fields: [] },
        { name: "b", fields: [] },
      ],
      refs: [],
    });
    expect(Object.keys(result.positions)).toHaveLength(2);
    expect(result.width).toBeGreaterThanOrEqual(ER_TABLE_WIDTH);
  });

  it("ignores a ref that names a missing table", () => {
    const result = layoutErModel({
      kind: "er-model",
      tables: [{ name: "a", fields: [] }],
      refs: [{ fromTable: "a", fromField: "x", toTable: "ghost", toField: "y", op: ">" }],
    });
    expect(Object.keys(result.positions)).toEqual(["a"]);
  });
});
