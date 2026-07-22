# Flow Diagram

Map a software use case end to end — screens, services, HTTP calls, databases
and topics — as one code-first diagram. The macro view shows how the pieces
connect; click a node for the detail that matters for that node: the request
payload and its response, the entity-relationship model, the event body, the
screen mockup.

The diagram is a text file, so it lives in the repo, diffs in a PR, and never
drifts from reality without somebody noticing.

## Getting started

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

## The language

```
screen MyOrders "My Orders" {
  desc: "Order list with filters"
  image: "https://…/mockup.png"
}

http GetOrders "GET /v1/orders" {
  method: GET
  path: /v1/orders
  request  { payload: `{ "page": 1 }` }
  response { status: 200  payload: `{ "total": 128 }` }
}

service OrderService "Order Service" {
  desc: "Orchestrates orders"
  external: false
}

db OrdersDB "Orders Database" {
  table order {
    id bigint [pk]
    campaign_id bigint [fk, not null]
  }
  ref: order.campaign_id > campaign.id
}

topic OrderEvents "order.events" {
  broker: kafka          # free text — not tied to any one message broker
  payload: `{ "type": "order.created" }`
}

flow Lookup "Order lookup" {
  MyOrders -> GetOrders : "request"
  GetOrders -> OrderService -> OrdersDB
}
```

Components are declared once and reused by any number of flows. A flow draws
only the components it touches, so one file can hold a success path and a
failure path without either becoming unreadable.

## Repository layout

| Path              | What it is                                                       |
|-------------------|------------------------------------------------------------------|
| `packages/lang`   | The language: lexer, parser, registry, validator, `DiagramIR`.    |
| `packages/layout` | `DiagramIR` to coordinates, via dagre. Pure geometry.             |
| `apps/web`        | The Next.js editor and canvas.                                    |

`@flow/lang` and `@flow/layout` never import React or touch the DOM — a lint
rule enforces it. That is what will let the language run as a CLI linter or a
CI check without a rewrite.

### Adding a node type

Add one entry to `packages/lang/src/schema/registry.ts` declaring its keyword,
properties, nested blocks and how it lowers to artifacts. The lexer, parser and
validator need no change; the canvas renders it through the fallback card until
you add a dedicated one in `apps/web/src/components/canvas/`.

## Commands

```bash
pnpm dev          # run the app
pnpm test         # unit tests (lang, layout, web)
pnpm test:e2e     # Playwright smoke tests
pnpm typecheck    # tsc across every package
pnpm lint         # eslint, incl. the no-DOM boundary rule
```

## What is not here yet

See [BACKLOG.md](BACKLOG.md) — Mermaid/DBML/OpenAPI adapters, PNG export,
share-by-URL, server persistence, collaboration.
