import { beforeEach, describe, expect, it } from "vitest";
import { SAMPLE_DIAGRAM } from "@/lib/sample-diagram";
import {
  isRenderable,
  selectDisplayIr,
  selectIsStale,
  useStudioStore,
} from "./studio-store";

const reset = () => {
  useStudioStore.getState().setSource(SAMPLE_DIAGRAM);
  useStudioStore.setState({ manualPositions: {}, screenImages: {}, selectedNodeId: null });
};

beforeEach(reset);

describe("initial state", () => {
  it("starts on the sample diagram with its first flow active", () => {
    const state = useStudioStore.getState();
    expect(state.ir.nodes.length).toBeGreaterThan(0);
    expect(state.activeFlowId).toBe(state.ir.flows[0]?.id);
  });

  it("compiles the sample diagram without errors", () => {
    expect(useStudioStore.getState().ir.diagnostics).toEqual([]);
  });
});

describe("setSource", () => {
  it("recompiles on every change", () => {
    useStudioStore.getState().setSource('service Solo "Solo" {}\nflow F {\n  Solo -> Solo\n}');
    expect(useStudioStore.getState().ir.nodes.map((n) => n.id)).toEqual(["Solo"]);
  });

  it("keeps the active flow when it still exists", () => {
    const { setSource } = useStudioStore.getState();
    setSource("service A {}\nflow One {\n  A -> A\n}\nflow Two {\n  A -> A\n}");
    useStudioStore.getState().setActiveFlow("Two");
    setSource("service A {}\nservice B {}\nflow One {\n  A -> A\n}\nflow Two {\n  A -> B\n}");
    expect(useStudioStore.getState().activeFlowId).toBe("Two");
  });

  it("falls back to the first flow when the active one disappears", () => {
    const { setSource } = useStudioStore.getState();
    setSource("service A {}\nflow One {\n  A -> A\n}\nflow Two {\n  A -> A\n}");
    useStudioStore.getState().setActiveFlow("Two");
    setSource("service A {}\nflow One {\n  A -> A\n}");
    expect(useStudioStore.getState().activeFlowId).toBe("One");
  });
});

describe("last valid diagram", () => {
  it("treats a compiled diagram with nodes and flows as renderable", () => {
    expect(isRenderable(useStudioStore.getState().ir)).toBe(true);
  });

  it("does not treat a syntax error as renderable", () => {
    useStudioStore.getState().setSource("service A {\nflow");
    expect(isRenderable(useStudioStore.getState().ir)).toBe(false);
  });

  it("keeps drawing the last valid diagram while the source is broken", () => {
    const before = selectDisplayIr(useStudioStore.getState());
    useStudioStore.getState().setSource("service A {");
    expect(selectDisplayIr(useStudioStore.getState())).toBe(before);
    expect(selectIsStale(useStudioStore.getState())).toBe(true);
  });

  it("goes back to the live diagram once the source is valid again", () => {
    useStudioStore.getState().setSource("service A {");
    useStudioStore.getState().setSource("service A {}\nflow F {\n  A -> A\n}");
    const state = useStudioStore.getState();
    expect(selectDisplayIr(state)).toBe(state.ir);
    expect(selectIsStale(state)).toBe(false);
  });

  it("is not stale before anything valid has ever compiled", () => {
    useStudioStore.setState({ lastValidIr: { version: 1, nodes: [], flows: [], diagnostics: [] } });
    useStudioStore.getState().setSource("!!!");
    expect(selectIsStale(useStudioStore.getState())).toBe(false);
  });
});

describe("canvas interactions", () => {
  it("records a manual node position", () => {
    useStudioStore.getState().setNodePosition("MyOrders", { x: 10, y: 20 });
    expect(useStudioStore.getState().manualPositions.MyOrders).toEqual({ x: 10, y: 20 });
  });

  it("clears manual positions on reset", () => {
    useStudioStore.getState().setNodePosition("MyOrders", { x: 10, y: 20 });
    useStudioStore.getState().resetLayout();
    expect(useStudioStore.getState().manualPositions).toEqual({});
  });

  it("selects and clears a node", () => {
    useStudioStore.getState().selectNode("MyOrders");
    expect(useStudioStore.getState().selectedNodeId).toBe("MyOrders");
    useStudioStore.getState().selectNode(null);
    expect(useStudioStore.getState().selectedNodeId).toBeNull();
  });

  it("stores a pasted screen image outside the DSL text", () => {
    useStudioStore.getState().setScreenImage("MyOrders", "data:image/png;base64,AAA");
    expect(useStudioStore.getState().screenImages.MyOrders).toBe("data:image/png;base64,AAA");
    expect(useStudioStore.getState().source).not.toContain("base64");
  });
});
