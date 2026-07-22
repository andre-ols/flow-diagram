import { describe, expect, it } from "vitest";
import { defaultRegistry } from "@flow/lang";
import { nodeTypeFor, nodeTypes } from "./node-types";

describe("nodeTypeFor", () => {
  it("has a dedicated card for every kind the language knows", () => {
    for (const keyword of defaultRegistry.keys()) {
      expect(nodeTypeFor(keyword)).toBe(keyword);
      expect(nodeTypes[keyword]).toBeDefined();
    }
  });

  it("routes an unknown kind to the fallback card instead of breaking", () => {
    expect(nodeTypeFor("lambda")).toBe("fallback");
    expect(nodeTypes.fallback).toBeDefined();
  });
});
