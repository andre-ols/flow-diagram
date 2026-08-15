import { describe, expect, it } from "vitest";
import { buildShareUrl, decodeShareHash, encodeShareHash } from "./share-url";

const DSL = `screen Inicio "Início" {
  desc: "Visão geral 🚀"
}

flow Principal "Fluxo principal" {
  Inicio -> Inicio
}`;

describe("share URL codec", () => {
  it("round-trips a Unicode DSL through a URL-safe compressed hash", async () => {
    const hash = await encodeShareHash(DSL);

    expect(hash).toMatch(/^#flow=[A-Za-z0-9_-]+$/);
    await expect(decodeShareHash(hash)).resolves.toBe(DSL);
  });

  it("ignores hashes that do not contain a shared flow", async () => {
    await expect(decodeShareHash("#section=canvas")).resolves.toBeNull();
    await expect(decodeShareHash("")).resolves.toBeNull();
  });

  it("rejects a malformed shared flow", async () => {
    await expect(decodeShareHash("#flow=not-valid-compressed-data")).rejects.toThrow(
      "Invalid shared flow",
    );
  });

  it("builds a link without carrying over an existing hash", async () => {
    const link = await buildShareUrl(DSL, "https://flow.example/editor?theme=dark#old");
    const url = new URL(link);

    expect(url.origin + url.pathname + url.search).toBe(
      "https://flow.example/editor?theme=dark",
    );
    await expect(decodeShareHash(url.hash)).resolves.toBe(DSL);
  });
});
