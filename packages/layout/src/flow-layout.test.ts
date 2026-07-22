import { describe, expect, it } from "vitest";
import { compile } from "@flow/lang";
import { layoutFlow, sizeOf } from "./flow-layout";

const CHAIN = `
screen S "S" {}
service A "A" {}
db B "B" {}
service Unused "Unused" {}
flow F "F" {
  S -> A
  A -> B
}
`;

describe("layoutFlow", () => {
  it("positions only the nodes the flow touches", () => {
    expect(Object.keys(layoutFlow(compile(CHAIN), "F").positions).sort()).toEqual([
      "A", "B", "S",
    ]);
  });

  it("lays the chain out left to right", () => {
    const { positions } = layoutFlow(compile(CHAIN), "F");
    expect(positions.S!.x).toBeLessThan(positions.A!.x);
    expect(positions.A!.x).toBeLessThan(positions.B!.x);
  });

  it("returns an empty result for an unknown flow id", () => {
    expect(layoutFlow(compile(CHAIN), "nope")).toEqual({ positions: {}, width: 0, height: 0 });
  });

  it("returns an empty result for a flow with no edges", () => {
    const ir = compile("service A {}\nflow F {}");
    expect(layoutFlow(ir, "F")).toEqual({ positions: {}, width: 0, height: 0 });
  });

  it("does not overlap siblings that share a rank", () => {
    const ir = compile("service A {}\nservice B {}\nservice C {}\nflow F {\n  A -> B\n  A -> C\n}");
    const { positions } = layoutFlow(ir, "F");
    expect(Math.abs(positions.B!.y - positions.C!.y)).toBeGreaterThanOrEqual(
      sizeOf("service").height,
    );
  });

  it("gives a screen node more height than other kinds", () => {
    expect(sizeOf("screen").height).toBeGreaterThan(sizeOf("service").height);
  });

  it("falls back to the default size for an unregistered kind", () => {
    expect(sizeOf("totally-unknown")).toEqual(sizeOf("service"));
  });

  it("reports a bounding box that contains every node", () => {
    const ir = compile(CHAIN);
    const { positions, width, height } = layoutFlow(ir, "F");
    for (const [id, point] of Object.entries(positions)) {
      const kind = ir.nodes.find((node) => node.id === id)?.kind ?? "service";
      expect(point.x + sizeOf(kind).width).toBeLessThanOrEqual(width);
      expect(point.y + sizeOf(kind).height).toBeLessThanOrEqual(height);
    }
  });

  it("handles a cycle without hanging", () => {
    const ir = compile("service A {}\nservice B {}\nflow F {\n  A -> B\n  B -> A\n}");
    expect(Object.keys(layoutFlow(ir, "F").positions).sort()).toEqual(["A", "B"]);
  });

  it("is deterministic", () => {
    const ir = compile(CHAIN);
    expect(layoutFlow(ir, "F")).toEqual(layoutFlow(ir, "F"));
  });
});
