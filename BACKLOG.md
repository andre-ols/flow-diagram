# Backlog

Ideas deliberately excluded from v1. Nothing here is committed to — this is a
parking lot so the v1 scope stays honest.

## Format interoperability

The `DiagramIR` contract in `@flow/lang` is the seam every one of these plugs
into. Each becomes a module in a new `@flow/adapters` package with the shape
`{ id, name, toIR?(text), fromIR?(ir) }`.

- **Mermaid export** — `flowchart LR` from the active flow. Smallest useful
  adapter; likely the first one built, and the one that proves the seam.
- **Mermaid import** — parse `flowchart`/`sequenceDiagram` into IR nodes.
- **DBML import/export** — a `db` block is already DBML-shaped. Round-tripping
  with dbdiagram.io is a strong hook.
- **OpenAPI / Swagger import** — generate `http` nodes from a spec file. Turns
  an existing API contract into a diagram with no typing.
- **draw.io / Excalidraw export** — hand the diagram to a design tool for
  freeform annotation.

## Diagram types

- **Sequence diagrams** — a flow already carries ordered edges, so a sequence
  view is a second renderer over the same IR, not a new language. Would add a
  `sequence` artifact kind.
- **C4 / container diagrams** — grouping nodes into system boundaries.
- **State machines** — `state` node kind + transition edges.

## Language

- **Flow-scoped component variants.** Today a `http` node carries exactly one
  response. The better model: a component declares several possible responses
  (200, 409, 500), and each `flow` picks which variant it exercises —
  `IntegrationService -> SyncOrder(409)`. A success flow and a failure flow then
  reuse the same component instead of duplicating it. This is the single most
  interesting language idea we deferred; revisit before adding anything else to
  the grammar.
- **Imports across files** — `import "./orders.flow"` so a large system splits
  into several files.
- **Node groups / boundaries** — `group "Payments" { ... }` to visually cluster
  services owned by one team.
- **Reusable snippets / variables** — shared payload fragments.
- **Formatter** — `flow fmt`, canonical formatting like `gofmt`/prettier.

## Editor & canvas

- **Export PNG / SVG** of the canvas, for pasting into Confluence, Notion, PRs.
- **Share by URL** — DSL compressed into the URL hash, no backend needed
  (the mermaid.live model).
- **Autocomplete in the editor** — node ids inside `flow` blocks, keywords,
  property names. The registry already has the data for this.
- **Hover cards** — preview a node's payload on hover in the canvas.
- **Edge routing controls** — curve/elbow per edge, as in the original
  prototype.
- **Node search / jump to definition** — click a node, cursor moves to its
  declaration in the editor.
- **Minimap and layout presets** — LR / TB / radial.

## Product

- **Server persistence** — Postgres, projects and diagrams as first-class
  records.
- **Auth and workspaces** — multi-tenant, roles, invitations.
- **Real-time collaboration** — CRDT on the source text.
- **Version history and diffs** — diagram-aware diffs ("this flow gained a
  Kafka topic"), which is the thing a git diff of the DSL can't show well.
- **Comments and annotations** — brainstorming and review on the canvas.
- **CLI + CI check** — `flow lint` in a pipeline so docs rot loudly instead of
  silently. This is why `@flow/lang` must stay free of React and browser APIs.
- **Embeddable viewer** — read-only iframe for internal wikis.
