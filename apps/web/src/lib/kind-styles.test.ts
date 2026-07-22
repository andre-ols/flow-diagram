import { describe, expect, it } from "vitest";
import { defaultRegistry } from "@flow/lang";
import { KIND_ORDER, kindMeta } from "./kind-styles";

describe("kindMeta", () => {
  it("covers every kind in the language registry", () => {
    for (const keyword of defaultRegistry.keys()) {
      expect(KIND_ORDER).toContain(keyword);
      expect(kindMeta(keyword).key).toBe(keyword);
    }
  });

  it("takes its label from the registry so there is one source of truth", () => {
    expect(kindMeta("http").label).toBe(defaultRegistry.get("http")?.label);
  });

  it("maps each kind to its own CSS variable", () => {
    expect(kindMeta("db").color).toBe("var(--kind-db)");
  });

  it("falls back for an unregistered kind instead of throwing", () => {
    const meta = kindMeta("lambda");
    expect(meta.label).toBe("COMPONENT");
    expect(meta.color).toBe("var(--kind-default)");
  });
});
