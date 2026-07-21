# Flow Diagram — v1 Design

**Date:** 2026-07-21
**Status:** Approved for planning

## Problem

Teams have no good way to see a single use case end to end. The screen lives in
Figma, the API contract in Swagger, the schema in dbdiagram, the event flow in
somebody's head, and the sequence of calls in a whiteboard photo. Each artifact
is accurate in isolation and useless for answering "what actually happens when a
user clicks *place order*?"

Flow Diagram maps one use case as a single code-first diagram. The macro view
shows screens, services, HTTP calls, databases and topics wired together. Click
a node and you get the detail that matters for that node: the request payload
and its response, the entity-relationship model, the event body, the screen
mockup.

Code-first, like dbdiagram: the diagram is a text file, so it lives in the repo,
diffs in a PR, and never drifts from reality without somebody noticing.

## Scope of v1

In: the language, the editor, the canvas, the detail views, local persistence.

Out: everything in [BACKLOG.md](../../../BACKLOG.md) — no backend, no auth, no
export formats, no adapters. v1 is a single-page client-side app.

The point of this scope is that the language and the IR are the hard,
long-lived part. Everything deferred plugs into the IR later without touching
the parser.

## Architecture

```
flow-diagram/
├─ apps/web/         Next.js 15 · Tailwind v4 · shadcn/ui · lucide-react
├─ packages/lang/    @flow/lang    — the language. No React, no browser APIs.
└─ packages/layout/  @flow/layout  — DiagramIR → node positions. Pure.
```

pnpm workspaces. `apps/web` depends on both packages; neither package depends on
the app or on each other beyond `@flow/layout` importing IR *types* from
`@flow/lang`.

The constraint that makes this worth splitting: **`@flow/lang` must run in
Node with no DOM.** That is what lets it become a CLI linter, a CI check, or a
published npm package later without a rewrite. It is a hard rule, enforced by an
ESLint boundary rule, not a convention.

`@flow/adapters` is deliberately *not* created in v1. An empty package is a
speculative abstraction. The real seam is the `DiagramIR` contract; the first
adapter creates the package.

---

## `@flow/lang` — the lexical layer

### Pipeline

```
source ──lexer──▶ tokens ──parser──▶ AST ──validator──▶ diagnostics
                                      │
                                      └──lowering──▶ DiagramIR
```

Four stages, four directories, each independently testable. The public API is
one function:

```ts
compile(source: string, registry?: NodeTypeRegistry): DiagramIR
```

**`compile` never throws.** Every failure — a stray brace, an unknown keyword, a
flow edge pointing at a node that does not exist — becomes a `Diagnostic` in the
result. This is not politeness; it is a hard requirement, because the input is a
textarea being typed into character by character, and a thrown exception means a
blank screen mid-keystroke.

### `lexer/`

Produces tokens carrying a `Span { start, end, line, col }`. Token kinds:
`IDENT`, `STRING` (`"..."`), `TEMPLATE` (backtick, multi-line, holds JSON),
`NUMBER`, `ARROW` (`->`), `LBRACE`, `RBRACE`, `LBRACKET`, `RBRACKET`, `COLON`,
`COMMA`, `DOT`, `REF_OP` (`>`, `<`, `-`, `<>`), `EOF`. Comments (`#` and `//`)
and whitespace are skipped, except newlines, which are significant inside
`fields`-mode blocks.

Spans exist so the editor can underline the exact offending characters. Every
AST node and every diagnostic carries one.

### `parser/`

Recursive descent, and **generic**. The parser knows the *shape* of the language
but not a single node type. It cannot tell you what `http` means:

```ebnf
Document    := Block*
Block       := IDENT Ident? String? '{' Entry* '}'
Entry       := Property | NestedBlock | EdgeStmt | RefStmt | FieldStmt
Property    := IDENT ':' Value
Value       := String | Template | Number | Ident | BareLine
NestedBlock := IDENT (Ident | Number)? String? '{' Entry* '}'
EdgeStmt    := Ident ('->' Ident)+ (':' String)?
RefStmt     := 'ref' ':' QualName REF_OP QualName
FieldStmt   := IDENT TypeExpr ('[' Flag (',' Flag)* ']')?
```

Entry kinds are disambiguated by two-token lookahead: `IDENT ':'` → Property,
`IDENT ... '{'` → NestedBlock, `IDENT '->'` → EdgeStmt, otherwise FieldStmt.
*Which* entry kinds are legal inside a given block comes from the registry, not
from the grammar.

**Error recovery:** on an unexpected token the parser records a `syntax-error`
diagnostic and skips to the next newline or closing brace, then keeps going. A
broken block does not poison the blocks after it.

### `schema/` — the node type registry

This is where the language grows. Adding `cache`, `job`, `lambda` or `s3` means
adding one entry here. It requires no change to the lexer, the parser, or the
validator.

```ts
type NodeTypeDef = {
  keyword: string              // 'http'
  label: string                // 'HTTP'  (shown on the card and in the legend)
  colorToken: string           // CSS variable name
  entryMode: 'properties' | 'fields' | 'edges'
  props: PropDef[]
  blocks: BlockDef[]
  toArtifacts(node: AstBlock): Artifact[]
}

type PropDef  = { name, kind: 'string'|'ident'|'code'|'enum'|'ref',
                  required?: boolean, values?: string[], repeatable?: boolean }
type BlockDef = { keyword, arity: 'one'|'many', header?: 'ident'|'number',
                  entryMode, props, blocks? }
```

`entryMode` is what lets one parser handle bodies that look nothing alike:
`db > table` parses `id bigint [pk]` in `fields` mode, `http > response` parses
`payload: \`...\`` in `properties` mode, and `flow` parses `A -> B : "x"` in
`edges` mode.

The v1 built-in registry:

| keyword   | body                                                        |
|-----------|-------------------------------------------------------------|
| `screen`  | `desc`, `image` (URL)                                        |
| `service` | `desc`, `external` (bool)                                    |
| `http`    | `method`, `path`, `desc`, `request {}`, `response {}`        |
| `db`      | `desc`, `table X { fields }`*, `ref:`*                        |
| `topic`   | `desc`, `broker` (free text), `payload` (code)               |
| `flow`    | edge statements                                              |

`http` carries exactly **one** `response` in v1. Multiple responses selected
per-flow is the most promising deferred language idea — see BACKLOG.

`topic` is deliberately broker-agnostic. `broker: kafka` is a free-text label
rendered as a badge, so switching to SQS or Pub/Sub never requires a new node
type.

### `validate/`

Walks the AST against the registry and emits `Diagnostic { severity, code,
message, span }`:

| code                   | severity | when                                        |
|------------------------|----------|---------------------------------------------|
| `syntax-error`         | error    | parser could not proceed                    |
| `unknown-block`        | error    | keyword not in registry                     |
| `unknown-prop`         | warning  | property not declared for that type         |
| `missing-required-prop`| error    | e.g. `http` without `method`                |
| `duplicate-id`         | error    | two blocks share an id                      |
| `unresolved-node-ref`  | error    | flow edge references an undeclared node     |
| `unresolved-table-ref` | error    | `ref:` points at a missing table or column  |
| `empty-flow`           | warning  | flow declares no edges                      |
| `orphan-node`          | warning  | node appears in no flow                     |

Warnings never block rendering. Errors suppress only the affected element.

### `ir/` — the contract

Everything downstream — canvas, detail views, future adapters, future CLI —
reads only this. It is the public surface of the whole project.

```ts
type DiagramIR = {
  version: 1
  nodes: IRNode[]
  flows: IRFlow[]
  diagnostics: Diagnostic[]
}

type IRNode = { id, kind, label, props: Record<string,string>,
                artifacts: Artifact[], span: Span }
type IRFlow = { id, label, edges: IREdge[] }
type IREdge = { from, to, label?: string, span: Span }
```

**The central idea: `Artifact`.** A node's detail view is not chosen by node
kind — it is chosen by the artifacts the node carries.

```ts
type Artifact =
  | { kind: 'http-exchange', method, path,
      request?: { payload?: string }, response?: { status: string, payload?: string } }
  | { kind: 'er-model',   tables: Table[], refs: Ref[] }
  | { kind: 'json-payload', title: string, json: string }
  | { kind: 'image',      src: string, alt?: string }
  | { kind: 'markdown',   text: string }
```

Two things fall out of this. A new node type that carries an `er-model` gets the
entity-relationship view for free. And a new *view* (a sequence diagram, an
OpenAPI table) is a new artifact kind plus one renderer, with no change to any
existing node. The detail panel is a `Record<ArtifactKind, Renderer>` map —
open for extension, closed for modification.

---

## `@flow/layout`

One pure function, no DOM:

```ts
layoutFlow(ir: DiagramIR, flowId: string, opts): { positions, width, height }
layoutErModel(model: ErModelArtifact): { positions, width, height }
```

Backed by `@dagrejs/dagre`, rank direction left-to-right, which reproduces the
layered look of the original prototype. Only nodes touched by the active flow's
edges are laid out. Node heights vary by kind — a `screen` is taller because it
shows a mockup thumbnail.

Pure and deterministic, so it is tested by asserting relative ordering (node B
is to the right of node A, siblings do not overlap) rather than pixel values.

---

## `apps/web`

A single route, `/`. Three zones, matching the approved design mockup.

```
<StudioShell>
  <StudioHeader/>            logo · flow tabs · legend · import/export · theme
  <ResizableGroup>
    <EditorPane/>            CodeMirror 6
    <CanvasPane/>            React Flow
  </ResizableGroup>
  <NodeDetailDialog/>        shadcn Dialog
</StudioShell>
```

**EditorPane** — CodeMirror 6 with a `StreamLanguage` for the DSL (keywords,
strings, template literals, comments, flags) and a `linter` source fed from
`ir.diagnostics`, so errors underline the offending span in place. Dark editor
surface against the light canvas, as in the mockup.

**CanvasPane** — React Flow v12. A `nodeTypes` map keyed by `kind`
(`ScreenNode`, `ServiceNode`, `HttpNode`, `DbNode`, `TopicNode`) with a
**`FallbackNode`** default. An unregistered kind renders as a plain labelled
card rather than crashing the canvas — the same open-for-extension rule as the
artifact renderers. Controls: zoom in/out, fit view, re-layout (discards manual
positions), plus drag-to-pan and scroll-to-zoom from React Flow.

**NodeDetailDialog** — renders the selected node's artifacts through an
`artifactRenderers` map: `HttpExchangeView` (method/path, request payload,
response status and payload, JSON syntax-highlighted), `ErModelView` (table
cards with PK/FK badges and relationship edges, positioned by `layoutErModel`),
`JsonPayloadView`, `ImageView`, `MarkdownView`.

**State** — one Zustand store: `source`, `ir`, `activeFlowId`, `selectedNodeId`,
`manualPositions`, `screenImages`. Compilation is debounced ~150 ms and runs
outside React render.

**Persistence** — autosave to localStorage; import/export a `.flow` file. Screen
mockups pasted or dropped into the dialog are stored as data URLs in
localStorage, keyed by node id, deliberately *outside* the DSL text so the
source stays readable and diffable. `image: "https://..."` in the DSL is the
portable alternative and takes precedence when present.

**Theme** — the oklch palette from the approved mockup, ported to Tailwind CSS
variables. Light and dark via `next-themes`.

## Error handling

The user's source is broken most of the time — that is what typing is. Three
rules:

1. `compile` never throws. Failures are diagnostics.
2. When the current source produces fatal errors, the canvas **keeps the last
   successfully compiled IR** and shows a small "showing last valid diagram"
   indicator. The diagram never flashes empty between keystrokes.
3. Diagnostics surface in two places: inline in the editor gutter, and as an
   error/warning count in the status bar that scrolls to the first problem when
   clicked.

## Testing

`@flow/lang` and `@flow/layout` are pure, fast and the core of the product, so
they are built **test-first** with vitest:

- lexer: token kinds and exact spans, including multi-line templates
- parser: each entry mode; error recovery (a broken block does not eat the next)
- validator: one test per diagnostic code, asserting code *and* span
- lowering: IR snapshots per node kind
- layout: determinism, relative ordering, no overlap

`apps/web` gets React Testing Library coverage of the store reducers and each
artifact renderer, plus one Playwright smoke test: type DSL → node appears →
click it → dialog shows the payload.

An ESLint boundary rule fails the build if `@flow/lang` imports React or any
browser global.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind v4 ·
shadcn/ui · lucide-react · @xyflow/react 12 · CodeMirror 6 · @dagrejs/dagre ·
Zustand · next-themes · vitest · Playwright · pnpm workspaces.

UI, code, comments and docs in English. DSL keywords in English.
