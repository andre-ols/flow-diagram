import { describe, expect, it } from "vitest";
import { parse } from "../parser/parser";
import { defaultRegistry } from "./registry";
import type {
  ErModelArtifact,
  HttpExchangeArtifact,
  ImageArtifact,
  JsonPayloadArtifact,
} from "../ir/artifacts";

const artifactsFor = (src: string) => {
  const block = parse(src).doc.blocks[0];
  if (!block) throw new Error("expected a block");
  const def = defaultRegistry.get(block.keyword);
  if (!def) throw new Error(`no registry entry for ${block.keyword}`);
  return def.toArtifacts(block);
};

describe("defaultRegistry", () => {
  it("registers exactly the v1 node kinds", () => {
    expect([...defaultRegistry.keys()].sort()).toEqual([
      "db", "http", "screen", "service", "topic",
    ]);
  });

  it("does not register flow as a node type", () => {
    expect(defaultRegistry.has("flow")).toBe(false);
  });
});

describe("toArtifacts", () => {
  it("builds an http-exchange with request and response", () => {
    const [artifact] = artifactsFor(
      'http GetOrders "GET /v1/orders" {\n' +
        "  method: GET\n" +
        "  path: /v1/orders\n" +
        '  request {\n    payload: `{"page":1}`\n  }\n' +
        '  response {\n    status: 200\n    payload: `{"total":128}`\n  }\n}',
    );
    expect(artifact).toEqual<HttpExchangeArtifact>({
      kind: "http-exchange",
      method: "GET",
      path: "/v1/orders",
      request: { payload: '{"page":1}' },
      response: { status: "200", payload: '{"total":128}' },
    });
  });

  it("omits request and response when absent", () => {
    const [artifact] = artifactsFor("http Ping {\n  method: GET\n  path: /ping\n}");
    expect(artifact).toEqual<HttpExchangeArtifact>({
      kind: "http-exchange",
      method: "GET",
      path: "/ping",
    });
  });

  it("uppercases the method", () => {
    const [artifact] = artifactsFor("http X {\n  method: post\n  path: /x\n}");
    expect((artifact as HttpExchangeArtifact).method).toBe("POST");
  });

  it("builds an er-model with tables, flags and refs", () => {
    const [artifact] = artifactsFor(
      "db OrdersDB {\n" +
        "  table campaign {\n    id bigint [pk]\n  }\n" +
        "  table order {\n    id bigint [pk]\n    campaign_id bigint [fk, not null]\n  }\n" +
        "  ref: order.campaign_id > campaign.id\n}",
    );
    const model = artifact as ErModelArtifact;
    expect(model.tables.map((t) => t.name)).toEqual(["campaign", "order"]);
    expect(model.tables[1]?.fields[1]).toEqual({
      name: "campaign_id",
      type: "bigint",
      pk: false,
      fk: true,
      notNull: true,
    });
    expect(model.refs).toEqual([
      {
        fromTable: "order",
        fromField: "campaign_id",
        toTable: "campaign",
        toField: "id",
        op: ">",
      },
    ]);
  });

  it("accepts nn as an alias for not null", () => {
    const [artifact] = artifactsFor("db D {\n  table t {\n    c bigint [nn]\n  }\n}");
    expect((artifact as ErModelArtifact).tables[0]?.fields[0]?.notNull).toBe(true);
  });

  it("builds a json-payload for a topic that has one", () => {
    const [artifact] = artifactsFor(
      'topic Events "order.events" {\n  payload: `{"type":"created"}`\n}',
    );
    expect(artifact).toEqual<JsonPayloadArtifact>({
      kind: "json-payload",
      title: "Message",
      json: '{"type":"created"}',
    });
  });

  it("gives a topic without a payload no artifacts", () => {
    expect(artifactsFor('topic Events "order.events" {\n  broker: kafka\n}')).toEqual([]);
  });

  it("builds an image artifact for a screen with an image", () => {
    const [artifact] = artifactsFor('screen S "My Orders" {\n  image: "https://x.test/a.png"\n}');
    expect(artifact).toEqual<ImageArtifact>({
      kind: "image",
      src: "https://x.test/a.png",
      alt: "My Orders",
    });
  });

  it("gives a plain service no artifacts", () => {
    expect(artifactsFor('service S {\n  desc: "x"\n}')).toEqual([]);
  });
});
