# Flow Legibility — Edges That Explain the Flow

**Date:** 2026-07-23
**Status:** Approved for planning

## Problem

The canvas draws the right connections but it does not *explain* them. Every
edge looks identical — the same animated dashed line — so two questions a reader
always has go unanswered:

1. **In what order do these events happen?** A `flow` is a sequence by
   definition, but the diagram flattens it. Nothing tells you that "Salva
   outbox" fires before "Gera Order".
2. **Which line connects to what, when lines overlap or cross?** In circular
   flows (a service calling another that calls back) or any dense graph, the
   traces tangle and the eye loses the thread.

The information to answer both already exists. Edge order is the declaration
order inside the `flow` block. Direction is inherent in every `IREdge`
(`from` → `to`). We are simply not surfacing it. This feature surfaces it.

This builds directly on the loop-routing fix (`LoopEdge`), which already stopped
backward edges from hiding behind cards. That made the lines *visible*; this
makes them *legible*.

## Scope

In: two complementary layers on the existing canvas — always-on step numbers,
and hover-driven directional highlighting.

Out: the "play" mode (auto-animating the flow step by step). It is the natural
next feature and the design leaves room for it, but it is not built here.

Both layers are pure presentation. No change to `@flow/lang`, `@flow/layout`,
the IR, the store's persisted shape, or the DSL. The ordering and direction data
are read straight off the active flow's `edges` array.

## The two layers

The layers answer different questions and are deliberately independent:

| Layer | Question | Trigger |
|-------|----------|---------|
| Step numbers | *When* does each event happen? | Always visible |
| Directional highlight | *What* does this card talk to, and which way? | Hover a card |

At rest the canvas stays calm: neutral grey edges, each carrying a small step
number. Colour only appears on demand. This matters because the direction colour
is **relative to the hovered card** — the same edge is "outgoing" for its sender
and "incoming" for its receiver — so there is no single correct colour to show
at rest. Neutral is the only honest resting state.

## Layer 1 — Step numbers

Each edge carries a step number taken from its index in the active flow's
`edges` array (`index + 1`). It renders as a small pill prefixing the edge's
existing label: `① Salva outbox`, `② Gera Order`, `③ Evento de retorno`. An
edge with no label shows the pill alone.

The pill is a styled HTML element, not a Unicode circled digit (`①` only runs to
20). It is rendered through React Flow's `EdgeLabelRenderer`, positioned at the
edge's `labelX`/`labelY`, so it rides the middle of each curve. When several
edges leave the same card, their pills spread along their separate curves rather
than stacking at a shared origin — the reason we chose the mid-curve label over
a badge at the source handle.

Numbering follows declaration order literally. If a card fires two things that a
reader might think of as "simultaneous", the DSL still declares one before the
other, and we number them `n` and `n+1`. We are numbering *declared* order, not
asserting true concurrency — an honest, predictable rule.

## Layer 2 — Directional highlight on hover

Hovering a card (`onNodeMouseEnter`, cleared on `onNodeMouseLeave`) sets a single
`hoveredNodeId`. Everything else derives from it:

- **Edges leaving the card → green (`--edge-out`).** Edges entering it → **blue
  (`--edge-in`).** Colour is computed per edge against the hovered id: `source
  === hovered` → out, `target === hovered` → in.
- **Connected neighbour cards stay lit; unrelated cards and edges dim** (reduced
  opacity), pushing the irrelevant graph into the background so the eye follows
  the live trace.
- **The marching-ants animation runs only on the highlighted edges**, in flow
  direction — green ants travel away from the card, blue ants arrive at it —
  reinforcing in/out. At rest, edges are static.

Green + blue is a colourblind-safe pair, and because the step numbers carry the
sequence regardless of colour, no information is colour-only.

## Colour and theme

Two new semantic tokens in `globals.css`, defined for light and dark:
`--edge-out` (green) and `--edge-in` (blue). They sit alongside the existing
`--kind-*` palette and are the only colours this feature introduces. The neutral
resting edge keeps using the current edge colour.

## Where it lives

Everything routes through the two files the loop fix already touched — no new
canvas plumbing, no new edge type beyond the existing `loop`.

- **`canvas-pane.tsx`** owns the interaction and the derivation. It holds
  `hoveredNodeId` in local state, wires `onNodeMouseEnter`/`onNodeMouseLeave`,
  and per edge computes `{ stepNumber, highlight: 'out' | 'in' | 'dim' | 'none' }`
  into the edge `data` (joining the `maxBottom` already there). It also applies
  the dim/lit state to nodes. Hover changes only restyle — they never rebuild the
  graph structure and never interfere with an in-progress drag.
- **`loop-edge.tsx`** already handles routing; it gains the presentation.
  It renders the numbered pill + label via `EdgeLabelRenderer`, and picks stroke
  colour, opacity and animation from `data.highlight`. Forward and backward edges
  share this styling — routing and legibility live in one place.

## Interaction and performance constraints

These are hard rules, the same spirit as "`compile` never throws":

1. **Hover never rebuilds the graph.** `derivedNodes` (the structural source of
   truth) must not depend on `hoveredNodeId`. Highlight is a styling pass over
   existing nodes/edges, recomputed only on hover enter/leave — not per frame,
   not per drag tick.
2. **Hover never disturbs a drag.** The transient drag state React Flow owns
   stays authoritative; highlighting reads position/identity but does not write
   node positions.
3. **`edgeTypes`/`nodeTypes` stay module-level and stable**, as they are now, so
   React Flow does not remount on every render.

## Testing

The pure, testable core here is the *derivation*, not the pixels — so that is
what we test, matching the project's "assert relations, not coordinates" habit:

- **Step number**: edge `n` of the active flow carries step `n + 1`; the pill
  renders with the label, and alone when the edge has no label.
- **Highlight state**: given a `hoveredNodeId`, an edge whose source is the
  hovered node resolves to `out`, whose target is the hovered node resolves to
  `in`, and an unrelated edge resolves to `dim`; with no hover every edge is
  `none`.
- **Neighbour set**: the cards kept lit for a given hovered node are exactly its
  direct graph neighbours.

Extract the derivation (edge highlight + neighbour computation) as a pure helper
so it is unit-testable without mounting React Flow. The visual layer
(colours, animation, `EdgeLabelRenderer` output) is covered by the existing
canvas render test asserting the numbered label appears.

## Out of scope

The "play" mode — stepping through the numbered edges automatically, one at a
time, for presentation — is deferred. The step numbers are its foundation; when
it is built it consumes the same per-edge ordering this feature establishes.
