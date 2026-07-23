import { describe, expect, it } from "vitest";
import { defaultRegistry } from "@flow/lang";
import { KIND_ORDER, kindMeta } from "./kind-styles";

describe("KIND_ORDER", () => {
  it("is exactly the registry keys, in order, so the two cannot drift", () => {
    expect(KIND_ORDER).toEqual([...defaultRegistry.keys()]);
  });
});

describe("kindMeta", () => {
  it("covers every kind in the language registry", () => {
    for (const keyword of defaultRegistry.keys()) {
      expect(KIND_ORDER).toContain(keyword);
      // A missing icon would fall back and report key "default"; asserting the
      // key round-trips is what validates ICONS against the registry.
      expect(kindMeta(keyword).key).toBe(keyword);
    }
  });

  it("takes its label from the registry so there is one source of truth", () => {
    expect(kindMeta("http").label).toBe(defaultRegistry.get("http")?.label);
  });

  it("reads the CSS variable from the registry's colorToken, not the kind name", () => {
    for (const [keyword, def] of defaultRegistry) {
      expect(kindMeta(keyword).color).toBe(`var(${def.colorToken})`);
    }
    // Concretely, for db that is the --kind-db custom property.
    expect(kindMeta("db").color).toBe("var(--kind-db)");
  });

  it("falls back for an unregistered kind instead of throwing", () => {
    const meta = kindMeta("lambda");
    expect(meta.label).toBe("COMPONENT");
    expect(meta.color).toBe("var(--kind-default)");
  });
});
