import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Artifact, ArtifactKind } from "@flow/lang";
import { ArtifactView, artifactRenderers } from "./artifact-renderers";
import { formatJson } from "./json-code";

const KINDS: ArtifactKind[] = ["http-exchange", "er-model", "json-payload", "image"];

describe("artifactRenderers", () => {
  it("has a renderer for every artifact kind the language can produce", () => {
    for (const kind of KINDS) expect(artifactRenderers[kind]).toBeDefined();
  });
});

describe("ArtifactView", () => {
  it("shows the method, path, request and response of an http exchange", () => {
    const artifact: Artifact = {
      kind: "http-exchange",
      method: "POST",
      path: "/crm/orders",
      request: { payload: '{"order_id":1}' },
      response: { status: "200", payload: '{"crm_id":"X"}' },
    };
    render(<ArtifactView artifact={artifact} />);
    expect(screen.getByText("POST")).toBeInTheDocument();
    expect(screen.getByText("/crm/orders")).toBeInTheDocument();
    expect(screen.getByText(/Request/i)).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
  });

  it("renders an http exchange that has no bodies at all", () => {
    render(<ArtifactView artifact={{ kind: "http-exchange", method: "GET", path: "/ping" }} />);
    expect(screen.getByText("/ping")).toBeInTheDocument();
    expect(screen.queryByText(/Request/i)).not.toBeInTheDocument();
  });

  it("shows every table and column of an er model", () => {
    render(
      <ArtifactView
        artifact={{
          kind: "er-model",
          tables: [
            { name: "order", fields: [{ name: "id", type: "bigint", pk: true, fk: false, notNull: true }] },
            { name: "item", fields: [{ name: "order_id", type: "bigint", pk: false, fk: true, notNull: false }] },
          ],
          refs: [{ fromTable: "item", fromField: "order_id", toTable: "order", toField: "id", op: ">" }],
        }}
      />,
    );
    expect(screen.getByText("order")).toBeInTheDocument();
    expect(screen.getByText("order_id")).toBeInTheDocument();
    expect(screen.getByText("PK")).toBeInTheDocument();
    expect(screen.getByText("FK")).toBeInTheDocument();
  });

  it("renders an empty er model without crashing", () => {
    render(<ArtifactView artifact={{ kind: "er-model", tables: [], refs: [] }} />);
    expect(screen.getByText(/no tables/i)).toBeInTheDocument();
  });

  it("shows a json payload under its title", () => {
    render(<ArtifactView artifact={{ kind: "json-payload", title: "Message", json: '{"a":1}' }} />);
    expect(screen.getByText("Message")).toBeInTheDocument();
  });

  it("shows an image artifact with its alt text", () => {
    render(<ArtifactView artifact={{ kind: "image", src: "https://x.test/a.png", alt: "Orders" }} />);
    expect(screen.getByAltText("Orders")).toBeInTheDocument();
  });
});

describe("formatJson", () => {
  it("pretty-prints valid json", () => {
    expect(formatJson('{"a":1}')).toBe('{\n  "a": 1\n}');
  });

  it("returns invalid json untouched rather than throwing", () => {
    expect(formatJson("{not json")).toBe("{not json");
  });
});
