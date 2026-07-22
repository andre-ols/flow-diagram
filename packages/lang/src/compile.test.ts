import { describe, expect, it } from "vitest";
import { compile, findNode, hasErrors } from "./compile";
import type { ErModelArtifact, HttpExchangeArtifact } from "./ir/artifacts";

const SAMPLE = `
screen MyOrders "My Orders" {
  desc: "Order list with filters"
}

http GetOrders "GET /v1/orders" {
  method: GET
  path: /v1/orders
  response {
    status: 200
    payload: \`{"total":128}\`
  }
}

service OrderService "Order Service" {
  desc: "Orchestrates orders"
}

db OrdersDB "Orders Database" {
  table campaign {
    id bigint [pk]
  }
  table order {
    id bigint [pk]
    campaign_id bigint [fk]
  }
  ref: order.campaign_id > campaign.id
}

topic OrderEvents "order.events" {
  broker: kafka
  payload: \`{"type":"order.created"}\`
}

flow Lookup "Order lookup" {
  MyOrders -> GetOrders : "request"
  GetOrders -> OrderService
  OrderService -> OrdersDB : "query"
  OrderService -> OrderEvents : "publish"
}
`;

describe("compile", () => {
  it("produces every declared node with its kind, in source order", () => {
    const ir = compile(SAMPLE);
    expect(ir.nodes.map((node) => [node.id, node.kind])).toEqual([
      ["MyOrders", "screen"],
      ["GetOrders", "http"],
      ["OrderService", "service"],
      ["OrdersDB", "db"],
      ["OrderEvents", "topic"],
    ]);
    expect(findNode(ir, "OrdersDB")?.label).toBe("Orders Database");
  });

  it("falls back to the id when no label is given", () => {
    expect(compile("service Bare {}").nodes[0]?.label).toBe("Bare");
  });

  it("collects scalar properties into props", () => {
    expect(findNode(compile(SAMPLE), "OrderEvents")?.props).toEqual({
      broker: "kafka",
      payload: '{"type":"order.created"}',
    });
  });

  it("attaches artifacts produced by the registry", () => {
    const ir = compile(SAMPLE);
    const exchange = findNode(ir, "GetOrders")?.artifacts[0] as HttpExchangeArtifact;
    expect(exchange.kind).toBe("http-exchange");
    expect(exchange.response?.status).toBe("200");

    const model = findNode(ir, "OrdersDB")?.artifacts[0] as ErModelArtifact;
    expect(model.tables).toHaveLength(2);
    expect(model.refs).toHaveLength(1);
  });

  it("expands multi-hop edges into pairs and labels only the last", () => {
    const ir = compile(
      'service A {}\nservice B {}\nservice C {}\nflow F {\n  A -> B -> C : "x"\n}',
    );
    expect(ir.flows[0]?.edges).toEqual([
      expect.objectContaining({ from: "A", to: "B", label: undefined }),
      expect.objectContaining({ from: "B", to: "C", label: "x" }),
    ]);
  });

  it("drops edges whose endpoints do not exist but keeps the diagnostic", () => {
    const ir = compile("service A {}\nflow F {\n  A -> Ghost\n}");
    expect(ir.flows[0]?.edges).toEqual([]);
    expect(ir.diagnostics.some((d) => d.code === "unresolved-node-ref")).toBe(true);
  });

  it("reports no diagnostics for a valid document", () => {
    expect(compile(SAMPLE).diagnostics).toEqual([]);
    expect(hasErrors(compile(SAMPLE))).toBe(false);
  });

  it("never throws on hostile input", () => {
    const inputs = [
      "",
      "   ",
      "}}}}",
      "{{{{",
      "service",
      "service A {",
      "db D { table t { ",
      "http H { method: `",
      "flow F { -> -> }",
      "ref: a.b > c.d",
      "a".repeat(20000),
    ];
    for (const input of inputs) {
      expect(() => compile(input)).not.toThrow();
      expect(compile(input).version).toBe(1);
    }
  });

  it("still returns the nodes it understood when part of the source is broken", () => {
    const ir = compile("service A {}\n!!! garbage !!!\nservice B {}");
    expect(ir.nodes.map((node) => node.id)).toEqual(["A", "B"]);
    expect(hasErrors(ir)).toBe(true);
  });

  it("keeps flows even when a sibling block has an unknown kind", () => {
    const ir = compile("lambda L {}\nservice A {}\nflow F {\n  A -> A\n}");
    expect(ir.flows).toHaveLength(1);
    expect(ir.nodes.map((node) => node.id)).toEqual(["A"]);
  });

  it("ignores the second definition of a duplicated id", () => {
    const ir = compile('service A "first" {}\nservice A "second" {}');
    expect(ir.nodes).toHaveLength(1);
    expect(ir.nodes[0]?.label).toBe("first");
  });
});
