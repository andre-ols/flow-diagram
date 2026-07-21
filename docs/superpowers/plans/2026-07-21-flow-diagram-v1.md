# Flow Diagram v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a code-first diagram tool where a DSL text file describes a software use case end to end — screens, services, HTTP calls, databases, topics — rendered as an interactive diagram whose nodes open detail views.

**Architecture:** pnpm monorepo. `@flow/lang` holds the whole language (lexer → parser → validator → lowering → `DiagramIR`) with no React and no DOM access. `@flow/layout` turns IR into coordinates. `apps/web` is a Next.js client-side app that only ever consumes `DiagramIR`. The parser is generic — it knows the *shape* of blocks, never a specific node type — and a registry supplies node types, so new components need no grammar change. Detail views dispatch on `Artifact` kind, not node kind.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TypeScript 5 (strict) · Tailwind v4 · shadcn/ui · lucide-react · @xyflow/react 12 · CodeMirror 6 · @dagrejs/dagre · Zustand 5 · next-themes · Vitest 3 · Playwright · pnpm workspaces.

**Reference:** [docs/superpowers/specs/2026-07-21-flow-diagram-design.md](../specs/2026-07-21-flow-diagram-design.md)

## Global Constraints

- **`@flow/lang` must never import React, Next.js, or any browser global** (`window`, `document`, `localStorage`). It must run in bare Node. Enforced by an ESLint rule in Task 1.
- **`compile()` must never throw.** Every failure becomes a `Diagnostic`. A top-level try/catch is the last-resort net.
- **Every AST node, IR node, IR edge and Diagnostic carries a `Span`** with absolute source offsets (`start`, `end`) plus `line` and `col`. The editor underlines errors using these offsets.
- **TypeScript `strict: true`** in every package. No `any` in exported signatures.
- **UI text, code, comments, docs and DSL keywords are all in English.**
- **v1 node kinds are exactly:** `screen`, `service`, `http`, `db`, `topic`. Plus the reserved `flow` keyword. `http` carries exactly **one** `response`.
- **v1 artifact kinds are exactly:** `http-exchange`, `er-model`, `json-payload`, `image`. (The spec also listed `markdown`; it is dropped because no v1 node type produces one — node descriptions live in `props.desc`.)
- **Package manager is pnpm.** Every install command uses `pnpm`, never `npm` or `yarn`.
- **Commit after every task.** Conventional commit prefixes (`chore:`, `feat:`, `test:`, `docs:`).

---

## File Structure

```
flow-diagram/
├─ pnpm-workspace.yaml
├─ package.json                        root scripts, devDeps
├─ tsconfig.base.json                  shared compiler options
├─ vitest.workspace.ts                 runs tests across all packages
├─ eslint.config.mjs                   incl. the no-DOM boundary rule
│
├─ packages/lang/
│  ├─ package.json  tsconfig.json
│  └─ src/
│     ├─ index.ts                      public API: compile, types, defaultRegistry
│     ├─ diagnostics.ts                Diagnostic, DiagnosticCode, severity
│     ├─ lexer/
│     │  ├─ tokens.ts                  Span, TokenKind, Token
│     │  └─ lexer.ts                   tokenize()
│     ├─ parser/
│     │  ├─ ast.ts                     AstDocument, AstBlock, AstEntry union
│     │  └─ parser.ts                  parse() — generic, error-recovering
│     ├─ schema/
│     │  ├─ types.ts                   NodeTypeDef, PropDef, BlockDef, EntryMode
│     │  └─ registry.ts                defaultRegistry — the 5 built-in types
│     ├─ validate/
│     │  └─ validate.ts                validate(doc, registry) → Diagnostic[]
│     ├─ ir/
│     │  ├─ artifacts.ts               Artifact union
│     │  ├─ ir.ts                      DiagramIR, IRNode, IRFlow, IREdge
│     │  └─ lower.ts                   lower(doc, registry) → nodes + flows
│     └─ compile.ts                    compile() — orchestrates, never throws
│
├─ packages/layout/
│  ├─ package.json  tsconfig.json
│  └─ src/
│     ├─ index.ts                      layoutFlow, layoutErModel, NODE_SIZE
│     ├─ flow-layout.ts
│     └─ er-layout.ts
│
└─ apps/web/
   └─ src/
      ├─ app/{layout.tsx,page.tsx,globals.css}
      ├─ components/
      │  ├─ studio/{studio-shell,studio-header,flow-tabs,legend,status-bar,io-buttons,theme-toggle}.tsx
      │  ├─ editor/{editor-pane.tsx,flow-language.ts,flow-linter.ts}
      │  ├─ canvas/{canvas-pane,node-shell,screen-node,service-node,http-node,db-node,topic-node,fallback-node,canvas-controls}.tsx + node-types.ts
      │  ├─ detail/{node-detail-dialog,artifact-renderers,http-exchange-view,er-model-view,json-payload-view,image-view,json-code}.tsx
      │  ├─ theme-provider.tsx
      │  └─ ui/                        shadcn primitives (generated)
      ├─ store/studio-store.ts
      └─ lib/{sample-diagram.ts,file-io.ts,kind-styles.ts,http-colors.ts,svg-path.ts,utils.ts}
```

---

## Task 1: Monorepo scaffold and tooling

Sets up the workspace and proves the test harness runs. No product code yet — everything after this task assumes `pnpm test` works.

**Files:**
- Create: `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, `vitest.workspace.ts`, `eslint.config.mjs`, `.gitignore`, `.npmrc`
- Create: `packages/lang/package.json`, `packages/lang/tsconfig.json`, `packages/lang/src/index.ts`
- Test: `packages/lang/src/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: workspace packages `@flow/lang` and `@flow/layout` resolvable by name; root scripts `pnpm test`, `pnpm typecheck`, `pnpm lint`.

- [ ] **Step 1: Create the workspace manifest files**

`pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`.npmrc`:

```
auto-install-peers=true
```

`package.json`:

```json
{
  "name": "flow-diagram",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "pnpm --filter @flow/web dev",
    "build": "pnpm -r build",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "pnpm -r typecheck",
    "lint": "eslint ."
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "eslint": "^9.17.0",
    "typescript": "^5.7.2",
    "typescript-eslint": "^8.18.0",
    "vitest": "^3.0.0"
  },
  "packageManager": "pnpm@9.15.0"
}
```

`.gitignore`:

```
node_modules/
dist/
.next/
coverage/
*.tsbuildinfo
.DS_Store
test-results/
playwright-report/
```

- [ ] **Step 2: Create the shared TypeScript config**

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

`noUncheckedIndexedAccess` is on deliberately: the lexer and parser index into arrays constantly, and this flag forces the undefined checks that make error recovery correct instead of crashy.

- [ ] **Step 3: Create the `@flow/lang` package**

`packages/lang/package.json`:

```json
{
  "name": "@flow/lang",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc --noEmit"
  }
}
```

The package is consumed as TypeScript source, not built output. Next.js transpiles it. This keeps the inner loop fast; a build step gets added only if the package is ever published.

`packages/lang/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true },
  "include": ["src"]
}
```

`packages/lang/src/index.ts`:

```ts
export const LANG_VERSION = "0.1.0";
```

- [ ] **Step 4: Configure Vitest across the workspace**

`vitest.workspace.ts`:

```ts
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      name: "lang",
      root: "./packages/lang",
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
  },
  {
    test: {
      name: "layout",
      root: "./packages/layout",
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
  },
]);
```

The `layout` entry references a package that does not exist until Task 8. Vitest tolerates a missing root only if the directory exists, so create a placeholder now:

```bash
mkdir -p packages/layout/src
```

- [ ] **Step 5: Add the ESLint boundary rule**

This is the rule that keeps `@flow/lang` runnable outside a browser. Without it the constraint is a wish.

`eslint.config.mjs`:

```js
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/dist/**", "**/.next/**"] },
  ...tseslint.configs.recommended,
  {
    files: ["packages/lang/**/*.ts", "packages/layout/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "window", message: "@flow/lang and @flow/layout must run in bare Node." },
        { name: "document", message: "@flow/lang and @flow/layout must run in bare Node." },
        { name: "localStorage", message: "@flow/lang and @flow/layout must run in bare Node." },
        { name: "navigator", message: "@flow/lang and @flow/layout must run in bare Node." },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["react", "react-*", "next", "next/*", "@xyflow/*"],
              message: "@flow/lang and @flow/layout must stay framework-free." },
          ],
        },
      ],
    },
  },
);
```

- [ ] **Step 6: Write the smoke test**

`packages/lang/src/smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LANG_VERSION } from "./index";

describe("test harness", () => {
  it("runs tests in @flow/lang", () => {
    expect(LANG_VERSION).toBe("0.1.0");
  });
});
```

- [ ] **Step 7: Install and run**

```bash
pnpm install
pnpm test
```

Expected: `1 passed` under the `lang` project. If Vitest errors about the missing `layout` root, confirm `packages/layout/src` exists.

```bash
pnpm typecheck
pnpm lint
```

Expected: both exit 0.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold pnpm monorepo with vitest and lang boundary lint"
```

---

## Task 2: Lexer

Turns source text into tokens carrying absolute spans. The lexer is **total** — it never fails on bad input. Anything unrecognized becomes a `bareword`, which is what lets values like `/v1/orders` survive without special grammar.

**Files:**
- Create: `packages/lang/src/lexer/tokens.ts`, `packages/lang/src/lexer/lexer.ts`
- Test: `packages/lang/src/lexer/lexer.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface Span { start: number; end: number; line: number; col: number }`
  - `type TokenKind = 'ident' | 'string' | 'template' | 'number' | 'bareword' | 'arrow' | 'refop' | 'lbrace' | 'rbrace' | 'lbracket' | 'rbracket' | 'lparen' | 'rparen' | 'colon' | 'comma' | 'dot' | 'eof'`
  - `interface Token { kind: TokenKind; value: string; span: Span }`
  - `function tokenize(source: string): Token[]` — always ends with exactly one `eof` token.

- [ ] **Step 1: Write the failing test**

`packages/lang/src/lexer/lexer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { tokenize } from "./lexer";

const kinds = (src: string) => tokenize(src).map((t) => t.kind);
const values = (src: string) => tokenize(src).map((t) => t.value);

describe("tokenize", () => {
  it("always terminates with a single eof token", () => {
    const tokens = tokenize("");
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.kind).toBe("eof");
  });

  it("lexes a block header", () => {
    expect(kinds('service OrderService "Order Service" {')).toEqual([
      "ident", "ident", "string", "lbrace", "eof",
    ]);
    expect(values('service OrderService "Order Service" {')).toEqual([
      "service", "OrderService", "Order Service", "{", "",
    ]);
  });

  it("records absolute offsets, line and column", () => {
    const [first, second] = tokenize("db\n  Orders");
    expect(first?.span).toEqual({ start: 0, end: 2, line: 1, col: 1 });
    expect(second?.span).toEqual({ start: 5, end: 11, line: 2, col: 3 });
  });

  it("skips # and // comments to end of line", () => {
    expect(kinds("# note\nfoo // trailing\nbar")).toEqual(["ident", "ident", "eof"]);
  });

  it("reads a multi-line template literal and keeps its start line", () => {
    const tokens = tokenize('payload: `{\n  "a": 1\n}`\nnext');
    const template = tokens.find((t) => t.kind === "template");
    expect(template?.value).toBe('{\n  "a": 1\n}');
    expect(template?.span.line).toBe(1);
    // the token after the template must report the correct line
    expect(tokens.at(-2)?.value).toBe("next");
    expect(tokens.at(-2)?.span.line).toBe(4);
  });

  it("distinguishes -> from ref operators", () => {
    expect(kinds("a -> b")).toEqual(["ident", "arrow", "ident", "eof"]);
    expect(values("x.y > z.w")).toEqual(["x", ".", "y", ">", "z", ".", "w", ""]);
    expect(kinds("a <> b")).toEqual(["ident", "refop", "ident", "eof"]);
  });

  it("lexes parenthesised column types", () => {
    expect(kinds("gross decimal(12,2)")).toEqual([
      "ident", "ident", "lparen", "number", "comma", "number", "rparen", "eof",
    ]);
  });

  it("falls back to bareword for unrecognised runs", () => {
    const tokens = tokenize("path: /v1/orders");
    expect(tokens[2]?.kind).toBe("bareword");
    expect(tokens[2]?.value).toBe("/v1/orders");
  });

  it("does not hang on an unterminated string or template", () => {
    expect(kinds('label: "unterminated')).toEqual(["ident", "colon", "string", "eof"]);
    expect(kinds("payload: `unterminated")).toEqual(["ident", "colon", "template", "eof"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/lang/src/lexer/lexer.test.ts`
Expected: FAIL — `Failed to resolve import "./lexer"`.

- [ ] **Step 3: Write the token types**

`packages/lang/src/lexer/tokens.ts`:

```ts
/** Absolute source location. `start`/`end` are character offsets; `line`/`col` are 1-based. */
export interface Span {
  start: number;
  end: number;
  line: number;
  col: number;
}

export type TokenKind =
  | "ident"
  | "string"
  | "template"
  | "number"
  | "bareword"
  | "arrow"
  | "refop"
  | "lbrace"
  | "rbrace"
  | "lbracket"
  | "rbracket"
  | "lparen"
  | "rparen"
  | "colon"
  | "comma"
  | "dot"
  | "eof";

export interface Token {
  kind: TokenKind;
  /** For strings and templates this is the *unquoted* contents. */
  value: string;
  span: Span;
}

export const EMPTY_SPAN: Span = { start: 0, end: 0, line: 1, col: 1 };

/** Smallest span covering both inputs. */
export function joinSpans(a: Span, b: Span): Span {
  return a.start <= b.start
    ? { start: a.start, end: Math.max(a.end, b.end), line: a.line, col: a.col }
    : { start: b.start, end: Math.max(a.end, b.end), line: b.line, col: b.col };
}
```

- [ ] **Step 4: Write the lexer**

`packages/lang/src/lexer/lexer.ts`:

```ts
import type { Span, Token, TokenKind } from "./tokens";

const SINGLE_CHAR: Record<string, TokenKind> = {
  "{": "lbrace",
  "}": "rbrace",
  "[": "lbracket",
  "]": "rbracket",
  "(": "lparen",
  ")": "rparen",
  ":": "colon",
  ",": "comma",
  ".": "dot",
};

/** Characters that terminate a bareword run. */
const BAREWORD_STOPS = new Set([
  "{", "}", "[", "]", "(", ")", ":", ",", ".", "<", ">", "-",
  '"', "`", " ", "\t", "\r", "\n", "#",
]);

const isIdentStart = (c: string) => /[A-Za-z_]/.test(c);
const isIdentPart = (c: string) => /[A-Za-z0-9_]/.test(c);
const isDigit = (c: string) => c >= "0" && c <= "9";

/**
 * Convert source text into tokens. Never throws and never loops forever:
 * every branch advances `i` by at least one character.
 */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let lineStart = 0;

  while (i < source.length) {
    const c = source[i] as string;

    if (c === "\n") {
      i += 1;
      line += 1;
      lineStart = i;
      continue;
    }
    if (c === " " || c === "\t" || c === "\r") {
      i += 1;
      continue;
    }
    if (c === "#" || (c === "/" && source[i + 1] === "/")) {
      while (i < source.length && source[i] !== "\n") i += 1;
      continue;
    }

    const start = i;
    const startLine = line;
    const startCol = i - lineStart + 1;
    let kind: TokenKind;
    let value: string;

    if (c === '"') {
      i += 1;
      while (i < source.length && source[i] !== '"' && source[i] !== "\n") i += 1;
      value = source.slice(start + 1, i);
      if (source[i] === '"') i += 1;
      kind = "string";
    } else if (c === "`") {
      i += 1;
      while (i < source.length && source[i] !== "`") {
        if (source[i] === "\n") {
          line += 1;
          lineStart = i + 1;
        }
        i += 1;
      }
      value = source.slice(start + 1, i);
      if (source[i] === "`") i += 1;
      kind = "template";
    } else if (isIdentStart(c)) {
      while (i < source.length && isIdentPart(source[i] as string)) i += 1;
      value = source.slice(start, i);
      kind = "ident";
    } else if (isDigit(c)) {
      while (i < source.length && isDigit(source[i] as string)) i += 1;
      value = source.slice(start, i);
      kind = "number";
    } else if (c === "-" && source[i + 1] === ">") {
      i += 2;
      value = "->";
      kind = "arrow";
    } else if (c === "<" && source[i + 1] === ">") {
      i += 2;
      value = "<>";
      kind = "refop";
    } else if (c === "<" || c === ">" || c === "-") {
      i += 1;
      value = c;
      kind = "refop";
    } else if (SINGLE_CHAR[c]) {
      i += 1;
      value = c;
      kind = SINGLE_CHAR[c];
    } else {
      while (i < source.length && !BAREWORD_STOPS.has(source[i] as string)) i += 1;
      if (i === start) i += 1; // guarantee progress on a lone stop character
      value = source.slice(start, i);
      kind = "bareword";
    }

    const span: Span = { start, end: i, line: startLine, col: startCol };
    tokens.push({ kind, value, span });
  }

  tokens.push({
    kind: "eof",
    value: "",
    span: { start: i, end: i, line, col: i - lineStart + 1 },
  });
  return tokens;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run packages/lang/src/lexer/lexer.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/lang/src/lexer
git commit -m "feat(lang): add total lexer with absolute source spans"
```

---

## Task 3: AST types and generic parser

The parser knows the *shape* of the language and not one node type. It dispatches entries purely by two-token lookahead, so adding `cache` or `lambda` later touches nothing here.

Error recovery is the point of this task as much as parsing is: the user's source is broken most of the time, and one bad block must not eat the blocks after it.

**Files:**
- Create: `packages/lang/src/diagnostics.ts`, `packages/lang/src/parser/ast.ts`, `packages/lang/src/parser/parser.ts`
- Test: `packages/lang/src/parser/parser.test.ts`

**Interfaces:**
- Consumes: `tokenize`, `Token`, `Span`, `joinSpans` from Task 2.
- Produces:
  - `type DiagnosticSeverity = 'error' | 'warning'`
  - `type DiagnosticCode = 'syntax-error' | 'unknown-block' | 'unknown-prop' | 'missing-required-prop' | 'missing-id' | 'duplicate-id' | 'unresolved-node-ref' | 'unresolved-table-ref' | 'empty-flow' | 'orphan-node' | 'internal-error'`
  - `interface Diagnostic { severity: DiagnosticSeverity; code: DiagnosticCode; message: string; span: Span }`
  - `interface AstBlock { keyword: string; keywordSpan: Span; id: string; idSpan: Span; label: string | null; entries: AstEntry[]; span: Span }`
  - `type AstEntry = AstProperty | AstNestedBlock | AstEdge | AstRef | AstField`
  - `interface AstProperty { type: 'property'; name: string; nameSpan: Span; value: string; valueKind: 'string' | 'template' | 'bare'; span: Span }`
  - `interface AstNestedBlock { type: 'block'; block: AstBlock }`
  - `interface AstEdge { type: 'edge'; hops: Array<{ name: string; span: Span }>; label: string | null; span: Span }`
  - `interface AstRef { type: 'ref'; from: QualName; op: string; to: QualName; span: Span }`
  - `interface AstField { type: 'field'; name: string; nameSpan: Span; fieldType: string; flags: string[]; span: Span }`
  - `interface QualName { table: string; column: string; span: Span }`
  - `interface AstDocument { blocks: AstBlock[] }`
  - `function parse(source: string): { doc: AstDocument; diagnostics: Diagnostic[] }`

- [ ] **Step 1: Write the failing test**

`packages/lang/src/parser/parser.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parse } from "./parser";
import type { AstBlock, AstEdge, AstField, AstProperty, AstRef } from "./ast";

const firstBlock = (src: string): AstBlock => {
  const block = parse(src).doc.blocks[0];
  if (!block) throw new Error("expected at least one block");
  return block;
};

describe("parse — block headers", () => {
  it("reads keyword, id and label", () => {
    const block = firstBlock('service OrderService "Order Service" {}');
    expect(block.keyword).toBe("service");
    expect(block.id).toBe("OrderService");
    expect(block.label).toBe("Order Service");
  });

  it("treats a missing label as null", () => {
    expect(firstBlock("service OrderService {}").label).toBeNull();
  });

  it("reports a missing id without dropping the block", () => {
    const { doc, diagnostics } = parse("service {}");
    expect(doc.blocks).toHaveLength(1);
    expect(diagnostics.map((d) => d.code)).toContain("missing-id");
  });
});

describe("parse — properties", () => {
  it("reads quoted, template and bare values", () => {
    const entries = firstBlock(
      'http X {\n  desc: "Lists orders"\n  payload: `{"a":1}`\n  path: /v1/orders\n}',
    ).entries as AstProperty[];
    expect(entries.map((e) => [e.name, e.value, e.valueKind])).toEqual([
      ["desc", "Lists orders", "string"],
      ["payload", '{"a":1}', "template"],
      ["path", "/v1/orders", "bare"],
    ]);
  });

  it("keeps a bare value on one line and out of the closing brace", () => {
    const entries = firstBlock("service S {\n  external: true\n}").entries as AstProperty[];
    expect(entries[0]?.value).toBe("true");
  });

  it("spans a property name precisely enough to underline it", () => {
    const entry = firstBlock("service S {\n  desc: \"x\"\n}").entries[0] as AstProperty;
    expect(entry.nameSpan.line).toBe(2);
    expect(entry.nameSpan.col).toBe(3);
  });
});

describe("parse — nested blocks", () => {
  it("nests request and response inside http", () => {
    const block = firstBlock(
      "http X {\n  request {\n    payload: `{}`\n  }\n  response {\n    status: 200\n  }\n}",
    );
    const nested = block.entries.filter((e) => e.type === "block");
    expect(nested).toHaveLength(2);
    expect(nested.map((e) => e.block.keyword)).toEqual(["request", "response"]);
  });

  it("nests table blocks with a header id inside db", () => {
    const block = firstBlock("db D {\n  table order {\n    id bigint [pk]\n  }\n}");
    const table = block.entries[0];
    if (table?.type !== "block") throw new Error("expected nested block");
    expect(table.block.keyword).toBe("table");
    expect(table.block.id).toBe("order");
  });
});

describe("parse — fields", () => {
  it("reads name, type and flags", () => {
    const block = firstBlock(
      "db D {\n  table t {\n    id bigint [pk]\n    total decimal(12,2)\n    name varchar(244) [not null]\n  }\n}",
    );
    const table = block.entries[0];
    if (table?.type !== "block") throw new Error("expected nested block");
    const fields = table.block.entries as AstField[];
    expect(fields.map((f) => [f.name, f.fieldType, f.flags])).toEqual([
      ["id", "bigint", ["pk"]],
      ["total", "decimal(12,2)", []],
      ["name", "varchar(244)", ["not null"]],
    ]);
  });

  it("reads multiple comma-separated flags", () => {
    const block = firstBlock("db D {\n  table t {\n    c bigint [pk, not null]\n  }\n}");
    const table = block.entries[0];
    if (table?.type !== "block") throw new Error("expected nested block");
    expect((table.block.entries[0] as AstField).flags).toEqual(["pk", "not null"]);
  });
});

describe("parse — edges and refs", () => {
  it("expands a multi-hop edge into pairs and attaches the label to the last hop", () => {
    const block = firstBlock('flow F {\n  A -> B -> C : "sends"\n}');
    const edge = block.entries[0] as AstEdge;
    expect(edge.hops.map((h) => h.name)).toEqual(["A", "B", "C"]);
    expect(edge.label).toBe("sends");
  });

  it("reads a ref with its operator", () => {
    const block = firstBlock("db D {\n  ref: order.campaign_id > campaign.id\n}");
    const ref = block.entries[0] as AstRef;
    expect(ref.from).toMatchObject({ table: "order", column: "campaign_id" });
    expect(ref.to).toMatchObject({ table: "campaign", column: "id" });
    expect(ref.op).toBe(">");
  });
});

describe("parse — error recovery", () => {
  it("keeps parsing blocks after a broken one", () => {
    const { doc, diagnostics } = parse("service A { !!! }\nservice B {}");
    expect(doc.blocks.map((b) => b.id)).toEqual(["A", "B"]);
    expect(diagnostics.some((d) => d.code === "syntax-error")).toBe(true);
  });

  it("recovers from a block missing its opening brace", () => {
    const { doc } = parse("service A\nservice B {}");
    expect(doc.blocks.map((b) => b.id)).toContain("B");
  });

  it("does not hang on an unclosed block", () => {
    const { doc, diagnostics } = parse("service A {\n  desc: \"x\"\n");
    expect(doc.blocks).toHaveLength(1);
    expect(diagnostics.some((d) => d.code === "syntax-error")).toBe(true);
  });

  it("reports stray top-level tokens without dropping later blocks", () => {
    const { doc, diagnostics } = parse("}}}\nservice B {}");
    expect(doc.blocks.map((b) => b.id)).toEqual(["B"]);
    expect(diagnostics.some((d) => d.code === "syntax-error")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/lang/src/parser/parser.test.ts`
Expected: FAIL — `Failed to resolve import "./parser"`.

- [ ] **Step 3: Write the diagnostics module**

`packages/lang/src/diagnostics.ts`:

```ts
import type { Span } from "./lexer/tokens";

export type DiagnosticSeverity = "error" | "warning";

export type DiagnosticCode =
  | "syntax-error"
  | "unknown-block"
  | "unknown-prop"
  | "missing-required-prop"
  | "missing-id"
  | "duplicate-id"
  | "unresolved-node-ref"
  | "unresolved-table-ref"
  | "empty-flow"
  | "orphan-node"
  | "internal-error";

export interface Diagnostic {
  severity: DiagnosticSeverity;
  code: DiagnosticCode;
  message: string;
  span: Span;
}

export function error(code: DiagnosticCode, message: string, span: Span): Diagnostic {
  return { severity: "error", code, message, span };
}

export function warning(code: DiagnosticCode, message: string, span: Span): Diagnostic {
  return { severity: "warning", code, message, span };
}
```

- [ ] **Step 4: Write the AST types**

`packages/lang/src/parser/ast.ts`:

```ts
import type { Span } from "../lexer/tokens";

export interface QualName {
  table: string;
  column: string;
  span: Span;
}

export interface AstProperty {
  type: "property";
  name: string;
  nameSpan: Span;
  value: string;
  valueKind: "string" | "template" | "bare";
  span: Span;
}

export interface AstNestedBlock {
  type: "block";
  block: AstBlock;
}

export interface AstEdge {
  type: "edge";
  hops: Array<{ name: string; span: Span }>;
  label: string | null;
  span: Span;
}

export interface AstRef {
  type: "ref";
  from: QualName;
  op: string;
  to: QualName;
  span: Span;
}

export interface AstField {
  type: "field";
  name: string;
  nameSpan: Span;
  fieldType: string;
  flags: string[];
  span: Span;
}

export type AstEntry = AstProperty | AstNestedBlock | AstEdge | AstRef | AstField;

export interface AstBlock {
  keyword: string;
  keywordSpan: Span;
  /** Empty string when the source omitted an id. */
  id: string;
  idSpan: Span;
  label: string | null;
  entries: AstEntry[];
  span: Span;
}

export interface AstDocument {
  blocks: AstBlock[];
}

/** Convenience: all properties of a block, in source order. */
export function properties(block: AstBlock): AstProperty[] {
  return block.entries.filter((e): e is AstProperty => e.type === "property");
}

/** Convenience: the first nested block with the given keyword. */
export function nestedBlock(block: AstBlock, keyword: string): AstBlock | undefined {
  for (const entry of block.entries) {
    if (entry.type === "block" && entry.block.keyword === keyword) return entry.block;
  }
  return undefined;
}

/** Convenience: every nested block with the given keyword. */
export function nestedBlocks(block: AstBlock, keyword: string): AstBlock[] {
  return block.entries
    .filter((e): e is AstNestedBlock => e.type === "block" && e.block.keyword === keyword)
    .map((e) => e.block);
}

/** Convenience: a property's value, or undefined. */
export function propValue(block: AstBlock, name: string): string | undefined {
  for (const entry of block.entries) {
    if (entry.type === "property" && entry.name === name) return entry.value;
  }
  return undefined;
}
```

- [ ] **Step 5: Write the parser**

`packages/lang/src/parser/parser.ts`:

```ts
import { error, type Diagnostic } from "../diagnostics";
import { joinSpans, type Span, type Token } from "../lexer/tokens";
import { tokenize } from "../lexer/lexer";
import type {
  AstBlock,
  AstDocument,
  AstEntry,
  AstField,
  AstProperty,
  QualName,
} from "./ast";

export interface ParseResult {
  doc: AstDocument;
  diagnostics: Diagnostic[];
}

export function parse(source: string): ParseResult {
  return new Parser(source, tokenize(source)).parseDocument();
}

class Parser {
  private pos = 0;
  private readonly diagnostics: Diagnostic[] = [];

  constructor(
    private readonly source: string,
    private readonly tokens: Token[],
  ) {}

  // ---- token helpers -------------------------------------------------

  private peek(offset = 0): Token {
    const token = this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
    // The token array always ends with eof, so this is total.
    return token as Token;
  }

  private at(kind: Token["kind"], offset = 0): boolean {
    return this.peek(offset).kind === kind;
  }

  private next(): Token {
    const token = this.peek();
    if (token.kind !== "eof") this.pos += 1;
    return token;
  }

  private report(message: string, span: Span): void {
    this.diagnostics.push(error("syntax-error", message, span));
  }

  /** Skip tokens until the start of a new line, a brace, or eof. Always advances. */
  private skipToLineEnd(): void {
    const line = this.peek().span.line;
    while (
      !this.at("eof") &&
      this.peek().span.line === line &&
      !this.at("rbrace") &&
      !this.at("lbrace")
    ) {
      this.pos += 1;
    }
  }

  // ---- document ------------------------------------------------------

  parseDocument(): ParseResult {
    const blocks: AstBlock[] = [];
    while (!this.at("eof")) {
      if (this.at("ident")) {
        const block = this.parseBlock();
        if (block) blocks.push(block);
      } else {
        const stray = this.next();
        this.report(`Unexpected "${stray.value || stray.kind}".`, stray.span);
      }
    }
    return { doc: { blocks }, diagnostics: this.diagnostics };
  }

  // ---- blocks --------------------------------------------------------

  /**
   * `keyword id? "label"? { entries }`. Returns null only when the block is so
   * malformed that nothing useful survives; the caller keeps going regardless.
   */
  private parseBlock(): AstBlock | null {
    const keywordToken = this.next();
    let id = "";
    let idSpan = keywordToken.span;
    let label: string | null = null;

    if (this.at("ident") || this.at("number")) {
      const idToken = this.next();
      id = idToken.value;
      idSpan = idToken.span;
    }
    if (this.at("string")) {
      label = this.next().value;
    }

    if (!id) {
      this.diagnostics.push(
        error("missing-id", `"${keywordToken.value}" needs a name.`, keywordToken.span),
      );
    }

    if (!this.at("lbrace")) {
      this.report(`Expected "{" after "${keywordToken.value}".`, this.peek().span);
      this.skipToLineEnd();
      return {
        keyword: keywordToken.value,
        keywordSpan: keywordToken.span,
        id,
        idSpan,
        label,
        entries: [],
        span: joinSpans(keywordToken.span, idSpan),
      };
    }

    this.next(); // consume "{"
    const entries = this.parseEntries();
    let endSpan = this.peek().span;
    if (this.at("rbrace")) {
      endSpan = this.next().span;
    } else {
      this.report(`Missing "}" to close "${keywordToken.value}".`, endSpan);
    }

    return {
      keyword: keywordToken.value,
      keywordSpan: keywordToken.span,
      id,
      idSpan,
      label,
      entries,
      span: joinSpans(keywordToken.span, endSpan),
    };
  }

  // ---- entries -------------------------------------------------------

  /**
   * Entry dispatch is pure two-token lookahead. The parser never consults the
   * node-type registry, which is what keeps it generic:
   *   IDENT ':'                     → property (or ref, when the name is "ref")
   *   IDENT (IDENT|STRING|NUM)? '{' → nested block
   *   IDENT '->'                    → edge
   *   IDENT IDENT                   → field
   */
  private parseEntries(): AstEntry[] {
    const entries: AstEntry[] = [];

    while (!this.at("eof") && !this.at("rbrace")) {
      if (!this.at("ident")) {
        const stray = this.next();
        this.report(`Unexpected "${stray.value || stray.kind}".`, stray.span);
        continue;
      }

      const startPos = this.pos;

      if (this.at("colon", 1)) {
        entries.push(this.peek().value === "ref" ? this.parseRef() : this.parseProperty());
      } else if (this.at("lbrace", 1) || this.at("lbrace", 2)) {
        const block = this.parseBlock();
        if (block) entries.push({ type: "block", block });
      } else if (this.at("arrow", 1)) {
        entries.push(this.parseEdge());
      } else if (this.at("ident", 1)) {
        entries.push(this.parseField());
      } else {
        const stray = this.next();
        this.report(`Unexpected "${stray.value || stray.kind}".`, stray.span);
      }

      // Absolute guarantee against an infinite loop if a branch consumed nothing.
      if (this.pos === startPos) this.pos += 1;
    }

    return entries;
  }

  private parseProperty(): AstProperty {
    const nameToken = this.next();
    const colon = this.next();

    if (this.at("string") || this.at("template")) {
      const valueToken = this.next();
      return {
        type: "property",
        name: nameToken.value,
        nameSpan: nameToken.span,
        value: valueToken.value,
        valueKind: valueToken.kind === "string" ? "string" : "template",
        span: joinSpans(nameToken.span, valueToken.span),
      };
    }

    // Bare value: every token on the colon's line, reconstructed by slicing the
    // source. Slicing means tokenisation quirks inside the value never matter.
    const line = colon.span.line;
    const first = this.peek();
    let end = colon.span.end;
    while (
      !this.at("eof") &&
      !this.at("rbrace") &&
      !this.at("lbrace") &&
      this.peek().span.line === line
    ) {
      end = this.next().span.end;
    }
    const value = end > colon.span.end ? this.source.slice(first.span.start, end).trim() : "";
    const valueSpan: Span =
      end > colon.span.end
        ? { start: first.span.start, end, line: first.span.line, col: first.span.col }
        : colon.span;

    if (!value) this.report(`"${nameToken.value}" has no value.`, valueSpan);

    return {
      type: "property",
      name: nameToken.value,
      nameSpan: nameToken.span,
      value,
      valueKind: "bare",
      span: joinSpans(nameToken.span, valueSpan),
    };
  }

  private parseRef(): AstEntry {
    const refToken = this.next(); // "ref"
    this.next(); // ":"
    const from = this.parseQualName();
    let op = "";
    let opSpan = this.peek().span;
    while (this.at("refop")) {
      const token = this.next();
      op += token.value;
      opSpan = token.span;
    }
    if (!op) this.report("Expected a relationship operator such as > or <.", opSpan);
    const to = this.parseQualName();
    return {
      type: "ref",
      from,
      op,
      to,
      span: joinSpans(refToken.span, to.span),
    };
  }

  private parseQualName(): QualName {
    const tableToken = this.at("ident") ? this.next() : this.peek();
    if (tableToken.kind !== "ident") {
      this.report("Expected a table name.", tableToken.span);
      return { table: "", column: "", span: tableToken.span };
    }
    if (!this.at("dot")) {
      this.report(`Expected ".column" after "${tableToken.value}".`, this.peek().span);
      return { table: tableToken.value, column: "", span: tableToken.span };
    }
    this.next(); // "."
    const columnToken = this.at("ident") ? this.next() : this.peek();
    if (columnToken.kind !== "ident") {
      this.report("Expected a column name.", columnToken.span);
      return { table: tableToken.value, column: "", span: tableToken.span };
    }
    return {
      table: tableToken.value,
      column: columnToken.value,
      span: joinSpans(tableToken.span, columnToken.span),
    };
  }

  private parseEdge(): AstEntry {
    const first = this.next();
    const hops = [{ name: first.value, span: first.span }];
    let end = first.span;

    while (this.at("arrow")) {
      this.next();
      if (!this.at("ident")) {
        this.report("Expected a node name after \"->\".", this.peek().span);
        break;
      }
      const hop = this.next();
      hops.push({ name: hop.value, span: hop.span });
      end = hop.span;
    }

    let label: string | null = null;
    if (this.at("colon")) {
      this.next();
      if (this.at("string")) {
        const labelToken = this.next();
        label = labelToken.value;
        end = labelToken.span;
      } else {
        this.report("Expected a quoted label after \":\".", this.peek().span);
      }
    }

    return { type: "edge", hops, label, span: joinSpans(first.span, end) };
  }

  private parseField(): AstField {
    const nameToken = this.next();
    const typeToken = this.next();
    let typeEnd = typeToken.span.end;

    // Optional parenthesised arguments: varchar(244), decimal(12,2)
    if (this.at("lparen")) {
      let depth = 0;
      do {
        const token = this.next();
        if (token.kind === "lparen") depth += 1;
        else if (token.kind === "rparen") depth -= 1;
        typeEnd = token.span.end;
        if (token.kind === "eof") break;
      } while (depth > 0);
    }
    const fieldType = this.source.slice(typeToken.span.start, typeEnd);

    const flags: string[] = [];
    let end = typeEnd;
    if (this.at("lbracket")) {
      this.next();
      let current: string[] = [];
      while (!this.at("eof") && !this.at("rbracket")) {
        const token = this.next();
        end = token.span.end;
        if (token.kind === "comma") {
          if (current.length) flags.push(current.join(" "));
          current = [];
        } else {
          current.push(token.value.toLowerCase());
        }
      }
      if (current.length) flags.push(current.join(" "));
      if (this.at("rbracket")) end = this.next().span.end;
      else this.report("Missing \"]\" after column flags.", this.peek().span);
    }

    const span: Span = {
      start: nameToken.span.start,
      end,
      line: nameToken.span.line,
      col: nameToken.span.col,
    };
    return {
      type: "field",
      name: nameToken.value,
      nameSpan: nameToken.span,
      fieldType,
      flags,
      span,
    };
  }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm vitest run packages/lang/src/parser/parser.test.ts`
Expected: PASS, 15 tests.

If the "unclosed block" test hangs, the guard at the end of `parseEntries` is missing — that guard is the only thing standing between a typo and a frozen browser tab.

- [ ] **Step 7: Commit**

```bash
git add packages/lang/src/diagnostics.ts packages/lang/src/parser
git commit -m "feat(lang): add generic error-recovering parser and AST"
```

---

## Task 4: Node type registry

The registry is where the language grows. Every fact about a node type — its keyword, its display label, its colour, which properties and nested blocks it accepts, and how it lowers to artifacts — lives in one entry. Adding `cache`, `job` or `lambda` later means adding an entry and nothing else.

**Files:**
- Create: `packages/lang/src/ir/artifacts.ts`, `packages/lang/src/schema/types.ts`, `packages/lang/src/schema/registry.ts`
- Test: `packages/lang/src/schema/registry.test.ts`

**Interfaces:**
- Consumes: `AstBlock`, `nestedBlock`, `nestedBlocks`, `propValue` from Task 3.
- Produces:
  - `type ArtifactKind = 'http-exchange' | 'er-model' | 'json-payload' | 'image'`
  - `type Artifact = HttpExchangeArtifact | ErModelArtifact | JsonPayloadArtifact | ImageArtifact`
  - `interface HttpExchangeArtifact { kind: 'http-exchange'; method: string; path: string; request?: { payload?: string }; response?: { status: string; payload?: string } }`
  - `interface ErModelArtifact { kind: 'er-model'; tables: ErTable[]; refs: ErRef[] }`
  - `interface ErTable { name: string; fields: ErField[] }`
  - `interface ErField { name: string; type: string; pk: boolean; fk: boolean; notNull: boolean }`
  - `interface ErRef { fromTable: string; fromField: string; toTable: string; toField: string; op: string }`
  - `interface JsonPayloadArtifact { kind: 'json-payload'; title: string; json: string }`
  - `interface ImageArtifact { kind: 'image'; src: string; alt?: string }`
  - `type EntryMode = 'properties' | 'fields' | 'edges'`
  - `interface PropDef { name: string; kind: 'string' | 'bare' | 'code' | 'enum' | 'boolean'; required?: boolean; values?: string[]; repeatable?: boolean }`
  - `interface BlockDef { keyword: string; arity: 'one' | 'many'; entryMode: EntryMode; props: PropDef[]; blocks?: BlockDef[] }`
  - `interface NodeTypeDef { keyword: string; label: string; colorToken: string; entryMode: EntryMode; allowRefs?: boolean; props: PropDef[]; blocks: BlockDef[]; toArtifacts(block: AstBlock): Artifact[] }`
  - `type NodeTypeRegistry = ReadonlyMap<string, NodeTypeDef>`
  - `function createRegistry(defs: NodeTypeDef[]): NodeTypeRegistry`
  - `const defaultRegistry: NodeTypeRegistry` — keys `screen`, `service`, `http`, `db`, `topic`
  - `const FLOW_KEYWORD = 'flow'`

- [ ] **Step 1: Write the failing test**

`packages/lang/src/schema/registry.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/lang/src/schema/registry.test.ts`
Expected: FAIL — `Failed to resolve import "./registry"`.

- [ ] **Step 3: Write the artifact types**

`packages/lang/src/ir/artifacts.ts`:

```ts
/**
 * An Artifact is a typed sub-document attached to a node. The detail panel
 * dispatches on artifact kind, never on node kind — so a new node type that
 * carries an er-model gets the entity-relationship view for free, and a new
 * view is a new artifact kind plus one renderer.
 */

export interface HttpExchangeArtifact {
  kind: "http-exchange";
  method: string;
  path: string;
  request?: { payload?: string };
  response?: { status: string; payload?: string };
}

export interface ErField {
  name: string;
  type: string;
  pk: boolean;
  fk: boolean;
  notNull: boolean;
}

export interface ErTable {
  name: string;
  fields: ErField[];
}

export interface ErRef {
  fromTable: string;
  fromField: string;
  toTable: string;
  toField: string;
  /** Raw relationship operator as written, e.g. ">", "<", "-", "<>". */
  op: string;
}

export interface ErModelArtifact {
  kind: "er-model";
  tables: ErTable[];
  refs: ErRef[];
}

export interface JsonPayloadArtifact {
  kind: "json-payload";
  title: string;
  json: string;
}

export interface ImageArtifact {
  kind: "image";
  src: string;
  alt?: string;
}

export type Artifact =
  | HttpExchangeArtifact
  | ErModelArtifact
  | JsonPayloadArtifact
  | ImageArtifact;

export type ArtifactKind = Artifact["kind"];
```

- [ ] **Step 4: Write the schema types**

`packages/lang/src/schema/types.ts`:

```ts
import type { AstBlock } from "../parser/ast";
import type { Artifact } from "../ir/artifacts";

/**
 * How a block body is meant to read. The parser dispatches by lookahead and
 * ignores this; the validator uses it to reject entries that make no sense for
 * a given block (a field statement inside `http`, an edge inside `db`).
 */
export type EntryMode = "properties" | "fields" | "edges";

export interface PropDef {
  name: string;
  kind: "string" | "bare" | "code" | "enum" | "boolean";
  required?: boolean;
  /** Allowed values when kind is "enum". Compared case-insensitively. */
  values?: string[];
  repeatable?: boolean;
}

export interface BlockDef {
  keyword: string;
  arity: "one" | "many";
  entryMode: EntryMode;
  props: PropDef[];
  blocks?: BlockDef[];
}

export interface NodeTypeDef {
  keyword: string;
  /** Shown on the card badge and in the canvas legend. */
  label: string;
  /** Name of the CSS custom property the web app uses for this kind. */
  colorToken: string;
  entryMode: EntryMode;
  /** Whether `ref:` statements are legal directly in this block's body. */
  allowRefs?: boolean;
  props: PropDef[];
  blocks: BlockDef[];
  toArtifacts(block: AstBlock): Artifact[];
}

export type NodeTypeRegistry = ReadonlyMap<string, NodeTypeDef>;

export function createRegistry(defs: NodeTypeDef[]): NodeTypeRegistry {
  return new Map(defs.map((def) => [def.keyword, def]));
}
```

- [ ] **Step 5: Write the built-in registry**

`packages/lang/src/schema/registry.ts`:

```ts
import { nestedBlock, nestedBlocks, propValue } from "../parser/ast";
import type {
  ErField,
  ErModelArtifact,
  ErRef,
  ErTable,
  HttpExchangeArtifact,
} from "../ir/artifacts";
import { createRegistry, type NodeTypeDef, type NodeTypeRegistry, type PropDef } from "./types";

/** `flow` is structural, not a node type, so it is never in the registry. */
export const FLOW_KEYWORD = "flow";

const DESC: PropDef = { name: "desc", kind: "string" };

const screen: NodeTypeDef = {
  keyword: "screen",
  label: "SCREEN",
  colorToken: "--kind-screen",
  entryMode: "properties",
  props: [DESC, { name: "image", kind: "string" }],
  blocks: [],
  toArtifacts(block) {
    const src = propValue(block, "image");
    if (!src) return [];
    return [{ kind: "image", src, alt: block.label ?? block.id }];
  },
};

const service: NodeTypeDef = {
  keyword: "service",
  label: "SERVICE",
  colorToken: "--kind-service",
  entryMode: "properties",
  props: [DESC, { name: "external", kind: "boolean" }],
  blocks: [],
  toArtifacts: () => [],
};

const http: NodeTypeDef = {
  keyword: "http",
  label: "HTTP",
  colorToken: "--kind-http",
  entryMode: "properties",
  props: [
    DESC,
    {
      name: "method",
      kind: "enum",
      required: true,
      values: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
    },
    { name: "path", kind: "bare", required: true },
  ],
  blocks: [
    {
      keyword: "request",
      arity: "one",
      entryMode: "properties",
      props: [{ name: "payload", kind: "code" }],
    },
    {
      keyword: "response",
      arity: "one",
      entryMode: "properties",
      props: [
        { name: "status", kind: "bare" },
        { name: "payload", kind: "code" },
      ],
    },
  ],
  toArtifacts(block) {
    const artifact: HttpExchangeArtifact = {
      kind: "http-exchange",
      method: (propValue(block, "method") ?? "").toUpperCase(),
      path: propValue(block, "path") ?? "",
    };

    const request = nestedBlock(block, "request");
    if (request) {
      const payload = propValue(request, "payload");
      artifact.request = payload === undefined ? {} : { payload };
    }

    const response = nestedBlock(block, "response");
    if (response) {
      const payload = propValue(response, "payload");
      artifact.response = {
        status: propValue(response, "status") ?? "200",
        ...(payload === undefined ? {} : { payload }),
      };
    }

    return [artifact];
  },
};

function toErField(entry: { name: string; fieldType: string; flags: string[] }): ErField {
  const flags = entry.flags.map((flag) => flag.toLowerCase());
  return {
    name: entry.name,
    type: entry.fieldType,
    pk: flags.includes("pk"),
    fk: flags.includes("fk"),
    notNull: flags.includes("not null") || flags.includes("nn"),
  };
}

const db: NodeTypeDef = {
  keyword: "db",
  label: "DATABASE",
  colorToken: "--kind-db",
  entryMode: "properties",
  allowRefs: true,
  props: [DESC],
  blocks: [{ keyword: "table", arity: "many", entryMode: "fields", props: [] }],
  toArtifacts(block) {
    const tables: ErTable[] = nestedBlocks(block, "table").map((table) => ({
      name: table.id,
      fields: table.entries
        .filter((entry) => entry.type === "field")
        .map((entry) => toErField(entry)),
    }));

    const refs: ErRef[] = block.entries
      .filter((entry) => entry.type === "ref")
      .map((entry) => ({
        fromTable: entry.from.table,
        fromField: entry.from.column,
        toTable: entry.to.table,
        toField: entry.to.column,
        op: entry.op,
      }));

    const model: ErModelArtifact = { kind: "er-model", tables, refs };
    return [model];
  },
};

const topic: NodeTypeDef = {
  keyword: "topic",
  label: "TOPIC",
  colorToken: "--kind-topic",
  entryMode: "properties",
  props: [
    DESC,
    // Free text on purpose: moving from Kafka to SQS must never require a new
    // node type.
    { name: "broker", kind: "bare" },
    { name: "payload", kind: "code" },
  ],
  blocks: [],
  toArtifacts(block) {
    const json = propValue(block, "payload");
    if (!json) return [];
    return [{ kind: "json-payload", title: "Message", json }];
  },
};

export const defaultRegistry: NodeTypeRegistry = createRegistry([
  screen,
  service,
  http,
  db,
  topic,
]);

export { createRegistry };
```

Note that `ref` is **not** listed in `db.props`. Refs are their own AST entry kind, gated by `allowRefs`, so they never go through property validation.

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm vitest run packages/lang/src/schema/registry.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 7: Commit**

```bash
git add packages/lang/src/ir/artifacts.ts packages/lang/src/schema
git commit -m "feat(lang): add node type registry and artifact types"
```

---

## Task 5: Validator

Turns the AST plus the registry into diagnostics. Every rule gets a test asserting both the code **and** the span, because a diagnostic pointing at the wrong characters is worse than no diagnostic.

**Files:**
- Create: `packages/lang/src/validate/validate.ts`
- Test: `packages/lang/src/validate/validate.test.ts`

**Interfaces:**
- Consumes: `AstDocument`, `AstBlock` (Task 3); `NodeTypeRegistry`, `defaultRegistry`, `FLOW_KEYWORD`, `BlockDef`, `PropDef`, `EntryMode` (Task 4); `error`, `warning`, `Diagnostic` (Task 3).
- Produces: `function validate(doc: AstDocument, registry: NodeTypeRegistry): Diagnostic[]` — sorted by `span.start`.

- [ ] **Step 1: Write the failing test**

`packages/lang/src/validate/validate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parse } from "../parser/parser";
import { defaultRegistry } from "../schema/registry";
import { validate } from "./validate";

const check = (src: string) => validate(parse(src).doc, defaultRegistry);
const codes = (src: string) => check(src).map((d) => d.code);

/** The exact text a diagnostic points at — this is what the editor underlines. */
const underlined = (src: string, code: string) => {
  const diagnostic = check(src).find((d) => d.code === code);
  if (!diagnostic) throw new Error(`no ${code} diagnostic in:\n${src}`);
  return src.slice(diagnostic.span.start, diagnostic.span.end);
};

const VALID = [
  'screen S "Orders" {\n  desc: "x"\n}',
  "http H {\n  method: GET\n  path: /x\n}",
  'flow F "Flow" {\n  S -> H\n}',
].join("\n\n");

describe("validate", () => {
  it("accepts a well-formed document", () => {
    expect(check(VALID)).toEqual([]);
  });

  it("flags an unknown block keyword and underlines the keyword", () => {
    const src = 'lambda L {\n  desc: "x"\n}';
    expect(codes(src)).toContain("unknown-block");
    expect(underlined(src, "unknown-block")).toBe("lambda");
  });

  it("flags an unknown property and underlines the property name", () => {
    const src = 'service S {\n  colour: "red"\n}';
    expect(underlined(src, "unknown-prop")).toBe("colour");
  });

  it("treats an unknown property as a warning, not an error", () => {
    expect(check('service S {\n  colour: "red"\n}')[0]?.severity).toBe("warning");
  });

  it("flags a missing required property and names it", () => {
    const src = "http H {\n  path: /x\n}";
    expect(codes(src)).toContain("missing-required-prop");
    const diagnostic = check(src).find((d) => d.code === "missing-required-prop");
    expect(diagnostic?.message).toContain("method");
  });

  it("flags an invalid enum value", () => {
    expect(codes("http H {\n  method: FETCH\n  path: /x\n}")).toContain("unknown-prop");
  });

  it("accepts a lower-case enum value", () => {
    expect(codes("http H {\n  method: get\n  path: /x\n}")).toEqual([]);
  });

  it("flags a duplicate id on its second occurrence", () => {
    const src = "service A {}\nservice A {}";
    const diagnostic = check(src).find((d) => d.code === "duplicate-id");
    expect(diagnostic?.span.line).toBe(2);
  });

  it("flags a flow edge pointing at an undeclared node", () => {
    const src = "service A {}\nflow F {\n  A -> Ghost\n}";
    expect(underlined(src, "unresolved-node-ref")).toBe("Ghost");
  });

  it("flags a ref pointing at a missing table", () => {
    const src = "db D {\n  table t {\n    id bigint [pk]\n  }\n  ref: t.id > ghost.id\n}";
    expect(codes(src)).toContain("unresolved-table-ref");
  });

  it("flags a ref pointing at a missing column", () => {
    const src = "db D {\n  table t {\n    id bigint [pk]\n  }\n  ref: t.nope > t.id\n}";
    expect(codes(src)).toContain("unresolved-table-ref");
  });

  it("accepts a valid ref", () => {
    const src =
      "db D {\n  table t {\n    id bigint [pk]\n    other bigint [fk]\n  }\n" +
      "  ref: t.other > t.id\n}\nflow F {\n  D -> D\n}";
    expect(codes(src)).toEqual([]);
  });

  it("warns about an empty flow", () => {
    expect(codes("service A {}\nflow F {}")).toContain("empty-flow");
  });

  it("warns about a node that appears in no flow", () => {
    expect(codes("service A {}\nservice B {}\nflow F {\n  A -> A\n}")).toContain("orphan-node");
  });

  it("does not warn about orphans when the document declares no flows", () => {
    expect(codes("service A {}")).not.toContain("orphan-node");
  });

  it("flags a field statement inside a properties-mode block", () => {
    expect(codes("service S {\n  id bigint\n}")).toContain("unknown-prop");
  });

  it("flags an unknown nested block", () => {
    expect(codes("http H {\n  method: GET\n  path: /x\n  headers {}\n}")).toContain(
      "unknown-block",
    );
  });

  it("flags a second response block", () => {
    const src = "http H {\n  method: GET\n  path: /x\n  response {}\n  response {}\n}";
    expect(codes(src)).toContain("unknown-block");
  });

  it("flags a connection written outside a flow block", () => {
    expect(codes("service A {\n  A -> A\n}")).toContain("unknown-block");
  });

  it("returns diagnostics sorted by source position", () => {
    const diagnostics = check('service S {\n  colour: "x"\n}\nlambda L {}');
    const starts = diagnostics.map((d) => d.span.start);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/lang/src/validate/validate.test.ts`
Expected: FAIL — `Failed to resolve import "./validate"`.

- [ ] **Step 3: Write the validator**

`packages/lang/src/validate/validate.ts`:

```ts
import { error, warning, type Diagnostic } from "../diagnostics";
import type { AstBlock, AstDocument } from "../parser/ast";
import { FLOW_KEYWORD } from "../schema/registry";
import type { BlockDef, EntryMode, NodeTypeRegistry, PropDef } from "../schema/types";

interface BlockShape {
  entryMode: EntryMode;
  allowRefs: boolean;
  props: PropDef[];
  blocks: BlockDef[];
}

export function validate(doc: AstDocument, registry: NodeTypeRegistry): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Pass 1: collect declarations and report unknown keywords and duplicate ids.
  const declared = new Map<string, AstBlock>();
  const flowIds = new Set<string>();
  const flows: AstBlock[] = [];

  for (const block of doc.blocks) {
    const isFlow = block.keyword === FLOW_KEYWORD;
    if (!isFlow && !registry.has(block.keyword)) {
      diagnostics.push(
        error("unknown-block", `Unknown component type "${block.keyword}".`, block.keywordSpan),
      );
      continue;
    }
    if (!block.id) continue; // the parser already reported missing-id
    if (declared.has(block.id) || flowIds.has(block.id)) {
      diagnostics.push(error("duplicate-id", `"${block.id}" is already defined.`, block.idSpan));
      continue;
    }
    if (isFlow) {
      flowIds.add(block.id);
      flows.push(block);
    } else {
      declared.set(block.id, block);
    }
  }

  // Pass 2: validate each block's body.
  for (const block of doc.blocks) {
    if (block.keyword === FLOW_KEYWORD) {
      validateFlow(block, declared, diagnostics);
      continue;
    }
    const def = registry.get(block.keyword);
    if (!def) continue;
    validateBlock(
      block,
      {
        entryMode: def.entryMode,
        allowRefs: def.allowRefs ?? false,
        props: def.props,
        blocks: def.blocks,
      },
      diagnostics,
    );
    if (def.allowRefs) validateRefs(block, diagnostics);
  }

  // Pass 3: orphans — only meaningful once at least one flow exists.
  if (flows.length > 0) {
    const used = new Set<string>();
    for (const flow of flows) {
      for (const entry of flow.entries) {
        if (entry.type === "edge") for (const hop of entry.hops) used.add(hop.name);
      }
    }
    for (const [id, block] of declared) {
      if (!used.has(id)) {
        diagnostics.push(warning("orphan-node", `"${id}" is not used by any flow.`, block.idSpan));
      }
    }
  }

  return diagnostics.sort((a, b) => a.span.start - b.span.start);
}

function validateBlock(block: AstBlock, shape: BlockShape, diagnostics: Diagnostic[]): void {
  const seenProps = new Set<string>();
  const blockCounts = new Map<string, number>();

  for (const entry of block.entries) {
    switch (entry.type) {
      case "property": {
        const def = shape.props.find((prop) => prop.name === entry.name);
        if (!def) {
          diagnostics.push(
            warning(
              "unknown-prop",
              `"${entry.name}" is not a property of "${block.keyword}".`,
              entry.nameSpan,
            ),
          );
          break;
        }
        if (!def.repeatable && seenProps.has(entry.name)) {
          diagnostics.push(
            warning("unknown-prop", `"${entry.name}" is set more than once.`, entry.nameSpan),
          );
        }
        seenProps.add(entry.name);
        if (def.kind === "enum" && def.values) {
          const allowed = def.values.map((value) => value.toLowerCase());
          if (!allowed.includes(entry.value.toLowerCase())) {
            diagnostics.push(
              warning(
                "unknown-prop",
                `"${entry.value}" is not valid for "${entry.name}". Expected one of: ${def.values.join(", ")}.`,
                entry.span,
              ),
            );
          }
        }
        break;
      }

      case "block": {
        const def = shape.blocks.find((nested) => nested.keyword === entry.block.keyword);
        if (!def) {
          diagnostics.push(
            error(
              "unknown-block",
              `"${entry.block.keyword}" is not allowed inside "${block.keyword}".`,
              entry.block.keywordSpan,
            ),
          );
          break;
        }
        const count = (blockCounts.get(def.keyword) ?? 0) + 1;
        blockCounts.set(def.keyword, count);
        if (def.arity === "one" && count > 1) {
          diagnostics.push(
            error(
              "unknown-block",
              `"${block.keyword}" allows only one "${def.keyword}" block.`,
              entry.block.keywordSpan,
            ),
          );
        }
        validateBlock(
          entry.block,
          {
            entryMode: def.entryMode,
            allowRefs: false,
            props: def.props,
            blocks: def.blocks ?? [],
          },
          diagnostics,
        );
        break;
      }

      case "field":
        if (shape.entryMode !== "fields") {
          diagnostics.push(
            warning(
              "unknown-prop",
              `"${entry.name}" is not a property of "${block.keyword}". Did you mean "${entry.name}:"?`,
              entry.nameSpan,
            ),
          );
        }
        break;

      case "edge":
        if (shape.entryMode !== "edges") {
          diagnostics.push(
            error("unknown-block", "Connections are only allowed inside a flow block.", entry.span),
          );
        }
        break;

      case "ref":
        if (!shape.allowRefs) {
          diagnostics.push(
            error("unknown-block", "ref is only allowed inside a db block.", entry.span),
          );
        }
        break;
    }
  }

  for (const def of shape.props) {
    if (def.required && !seenProps.has(def.name)) {
      diagnostics.push(
        error(
          "missing-required-prop",
          `"${block.keyword}" requires "${def.name}".`,
          block.keywordSpan,
        ),
      );
    }
  }
}

function validateFlow(
  flow: AstBlock,
  declared: Map<string, AstBlock>,
  diagnostics: Diagnostic[],
): void {
  let edgeCount = 0;

  for (const entry of flow.entries) {
    if (entry.type === "edge") {
      edgeCount += 1;
      for (const hop of entry.hops) {
        if (!declared.has(hop.name)) {
          diagnostics.push(
            error("unresolved-node-ref", `"${hop.name}" is not defined.`, hop.span),
          );
        }
      }
    } else if (entry.type !== "block") {
      diagnostics.push(
        warning("unknown-prop", "A flow block only contains connections.", entry.span),
      );
    }
  }

  if (edgeCount === 0) {
    diagnostics.push(
      warning(
        "empty-flow",
        `Flow "${flow.id || flow.keyword}" has no connections.`,
        flow.keywordSpan,
      ),
    );
  }
}

function validateRefs(block: AstBlock, diagnostics: Diagnostic[]): void {
  const tables = new Map<string, Set<string>>();
  for (const entry of block.entries) {
    if (entry.type !== "block" || entry.block.keyword !== "table") continue;
    const columns = new Set<string>();
    for (const field of entry.block.entries) {
      if (field.type === "field") columns.add(field.name);
    }
    tables.set(entry.block.id, columns);
  }

  for (const entry of block.entries) {
    if (entry.type !== "ref") continue;
    for (const side of [entry.from, entry.to]) {
      const columns = tables.get(side.table);
      if (!columns) {
        diagnostics.push(
          error(
            "unresolved-table-ref",
            `Table "${side.table}" is not defined in "${block.id}".`,
            side.span,
          ),
        );
      } else if (side.column && !columns.has(side.column)) {
        diagnostics.push(
          error(
            "unresolved-table-ref",
            `Column "${side.column}" is not defined on "${side.table}".`,
            side.span,
          ),
        );
      }
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run packages/lang/src/validate/validate.test.ts`
Expected: PASS, 20 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/lang/src/validate
git commit -m "feat(lang): add validator with span-accurate diagnostics"
```

---

## Task 6: Lowering, IR and the public compile API

Produces the `DiagramIR` — the contract every consumer reads, now and in future. This task also closes the "never throws" guarantee and gives the package its public surface.

**Files:**
- Create: `packages/lang/src/ir/ir.ts`, `packages/lang/src/ir/lower.ts`, `packages/lang/src/compile.ts`
- Modify: `packages/lang/src/index.ts` (replace the Task 1 placeholder entirely)
- Delete: `packages/lang/src/smoke.test.ts`
- Test: `packages/lang/src/compile.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–5.
- Produces:
  - `interface IRNode { id: string; kind: string; label: string; props: Record<string, string>; artifacts: Artifact[]; span: Span }`
  - `interface IREdge { from: string; to: string; label?: string; span: Span }`
  - `interface IRFlow { id: string; label: string; edges: IREdge[] }`
  - `interface DiagramIR { version: 1; nodes: IRNode[]; flows: IRFlow[]; diagnostics: Diagnostic[] }`
  - `const EMPTY_IR: DiagramIR`
  - `function lower(doc: AstDocument, registry: NodeTypeRegistry): { nodes: IRNode[]; flows: IRFlow[] }`
  - `function compile(source: string, registry?: NodeTypeRegistry): DiagramIR`
  - `function findNode(ir: DiagramIR, id: string): IRNode | undefined`
  - `function hasErrors(ir: DiagramIR): boolean`

- [ ] **Step 1: Write the failing test**

`packages/lang/src/compile.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run packages/lang/src/compile.test.ts`
Expected: FAIL — `Failed to resolve import "./compile"`.

- [ ] **Step 3: Write the IR types**

`packages/lang/src/ir/ir.ts`:

```ts
import type { Diagnostic } from "../diagnostics";
import type { Span } from "../lexer/tokens";
import type { Artifact } from "./artifacts";

export interface IRNode {
  id: string;
  /** Registry keyword: screen | service | http | db | topic | future kinds. */
  kind: string;
  label: string;
  /** Scalar properties exactly as written, keyed by name. */
  props: Record<string, string>;
  artifacts: Artifact[];
  span: Span;
}

export interface IREdge {
  from: string;
  to: string;
  label?: string;
  span: Span;
}

export interface IRFlow {
  id: string;
  label: string;
  edges: IREdge[];
}

export interface DiagramIR {
  version: 1;
  nodes: IRNode[];
  flows: IRFlow[];
  diagnostics: Diagnostic[];
}

export const EMPTY_IR: DiagramIR = { version: 1, nodes: [], flows: [], diagnostics: [] };
```

- [ ] **Step 4: Write the lowering step**

`packages/lang/src/ir/lower.ts`:

```ts
import type { AstDocument } from "../parser/ast";
import { FLOW_KEYWORD } from "../schema/registry";
import type { NodeTypeRegistry } from "../schema/types";
import type { IREdge, IRFlow, IRNode } from "./ir";

export function lower(
  doc: AstDocument,
  registry: NodeTypeRegistry,
): { nodes: IRNode[]; flows: IRFlow[] } {
  const nodes: IRNode[] = [];
  const seen = new Set<string>();

  for (const block of doc.blocks) {
    if (block.keyword === FLOW_KEYWORD) continue;
    const def = registry.get(block.keyword);
    // Unknown kinds and duplicates are reported by validate(); here they are
    // simply skipped so the rest of the diagram still renders.
    if (!def || !block.id || seen.has(block.id)) continue;
    seen.add(block.id);

    const props: Record<string, string> = {};
    for (const entry of block.entries) {
      if (entry.type === "property") props[entry.name] = entry.value;
    }

    nodes.push({
      id: block.id,
      kind: def.keyword,
      label: block.label ?? block.id,
      props,
      artifacts: def.toArtifacts(block),
      span: block.span,
    });
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const flows: IRFlow[] = [];
  const seenFlows = new Set<string>();

  for (const block of doc.blocks) {
    if (block.keyword !== FLOW_KEYWORD || !block.id || seenFlows.has(block.id)) continue;
    seenFlows.add(block.id);
    const edges: IREdge[] = [];

    for (const entry of block.entries) {
      if (entry.type !== "edge") continue;
      for (let i = 0; i < entry.hops.length - 1; i += 1) {
        const from = entry.hops[i];
        const to = entry.hops[i + 1];
        if (!from || !to) continue;
        if (!nodeIds.has(from.name) || !nodeIds.has(to.name)) continue;
        edges.push({
          from: from.name,
          to: to.name,
          label: i === entry.hops.length - 2 ? (entry.label ?? undefined) : undefined,
          span: entry.span,
        });
      }
    }

    flows.push({ id: block.id, label: block.label ?? block.id, edges });
  }

  return { nodes, flows };
}
```

- [ ] **Step 5: Write compile()**

`packages/lang/src/compile.ts`:

```ts
import { error, type Diagnostic } from "./diagnostics";
import { EMPTY_SPAN } from "./lexer/tokens";
import { parse } from "./parser/parser";
import { defaultRegistry } from "./schema/registry";
import type { NodeTypeRegistry } from "./schema/types";
import { validate } from "./validate/validate";
import { lower } from "./ir/lower";
import type { DiagramIR, IRNode } from "./ir/ir";

/**
 * Source text to DiagramIR.
 *
 * This function never throws. The input is a textarea being typed into, so a
 * thrown exception means a blank screen mid-keystroke. Every failure — a stray
 * brace, an unknown keyword, an internal bug — comes back as a Diagnostic.
 */
export function compile(
  source: string,
  registry: NodeTypeRegistry = defaultRegistry,
): DiagramIR {
  try {
    const { doc, diagnostics: parseDiagnostics } = parse(source);
    const validationDiagnostics = validate(doc, registry);
    const { nodes, flows } = lower(doc, registry);
    const diagnostics: Diagnostic[] = [...parseDiagnostics, ...validationDiagnostics].sort(
      (a, b) => a.span.start - b.span.start,
    );
    return { version: 1, nodes, flows, diagnostics };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return {
      version: 1,
      nodes: [],
      flows: [],
      diagnostics: [error("internal-error", `Could not read the diagram: ${message}`, EMPTY_SPAN)],
    };
  }
}

export function findNode(ir: DiagramIR, id: string): IRNode | undefined {
  return ir.nodes.find((node) => node.id === id);
}

export function hasErrors(ir: DiagramIR): boolean {
  return ir.diagnostics.some((diagnostic) => diagnostic.severity === "error");
}
```

- [ ] **Step 6: Write the public API surface**

Replace the contents of `packages/lang/src/index.ts`:

```ts
export { compile, findNode, hasErrors } from "./compile";
export { EMPTY_IR } from "./ir/ir";
export { defaultRegistry, createRegistry, FLOW_KEYWORD } from "./schema/registry";
export { parse } from "./parser/parser";
export { tokenize } from "./lexer/lexer";

export type { Span, Token, TokenKind } from "./lexer/tokens";
export type { Diagnostic, DiagnosticCode, DiagnosticSeverity } from "./diagnostics";
export type { AstBlock, AstDocument, AstEntry } from "./parser/ast";
export type {
  NodeTypeDef,
  NodeTypeRegistry,
  PropDef,
  BlockDef,
  EntryMode,
} from "./schema/types";
export type { DiagramIR, IRNode, IRFlow, IREdge } from "./ir/ir";
export type {
  Artifact,
  ArtifactKind,
  HttpExchangeArtifact,
  ErModelArtifact,
  ErTable,
  ErField,
  ErRef,
  JsonPayloadArtifact,
  ImageArtifact,
} from "./ir/artifacts";
```

Then remove the Task 1 placeholder test, which asserted a constant that no longer exists:

```bash
rm packages/lang/src/smoke.test.ts
```

- [ ] **Step 7: Run the full lang suite**

Run: `pnpm vitest run --project lang`
Expected: PASS — four test files, roughly 55 tests.

Run: `pnpm typecheck && pnpm lint`
Expected: both exit 0. If lint reports a restricted import inside `@flow/lang`, something browser-specific crept in — remove it rather than relaxing the rule.

- [ ] **Step 8: Commit**

```bash
git add packages/lang
git commit -m "feat(lang): add IR lowering and the compile() public API"
```

---

## Task 7: Layout package

Pure geometry. Tests assert relative ordering and non-overlap rather than exact pixels, so the suite survives a dagre version bump.

**Files:**
- Create: `packages/layout/package.json`, `packages/layout/tsconfig.json`, `packages/layout/src/index.ts`, `packages/layout/src/flow-layout.ts`, `packages/layout/src/er-layout.ts`
- Test: `packages/layout/src/flow-layout.test.ts`, `packages/layout/src/er-layout.test.ts`

**Interfaces:**
- Consumes: `DiagramIR`, `ErModelArtifact` from `@flow/lang`.
- Produces:
  - `interface NodeSize { width: number; height: number }`
  - `interface Point { x: number; y: number }`
  - `interface LayoutResult { positions: Record<string, Point>; width: number; height: number }`
  - `const NODE_SIZE: Record<string, NodeSize>` — keys `screen` and `default`
  - `function sizeOf(kind: string): NodeSize`
  - `const ER_TABLE_WIDTH: number`, `const ER_HEADER_HEIGHT: number`, `const ER_ROW_HEIGHT: number`
  - `function erTableHeight(fieldCount: number): number`
  - `function layoutFlow(ir: DiagramIR, flowId: string): LayoutResult`
  - `function layoutErModel(model: ErModelArtifact): LayoutResult`

Positions are **top-left corners**, because that is what React Flow and absolute CSS positioning both want. Dagre reports centres; the conversion happens here so no consumer has to remember.

- [ ] **Step 1: Create the package**

`packages/layout/package.json`:

```json
{
  "name": "@flow/layout",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc --noEmit" },
  "dependencies": {
    "@dagrejs/dagre": "^1.1.4",
    "@flow/lang": "workspace:*"
  }
}
```

`packages/layout/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true },
  "include": ["src"]
}
```

```bash
pnpm install
```

- [ ] **Step 2: Write the failing tests**

`packages/layout/src/flow-layout.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { compile } from "@flow/lang";
import { layoutFlow, sizeOf } from "./flow-layout";

const CHAIN = `
screen S "S" {}
service A "A" {}
db B "B" {}
service Unused "Unused" {}
flow F "F" {
  S -> A
  A -> B
}
`;

describe("layoutFlow", () => {
  it("positions only the nodes the flow touches", () => {
    expect(Object.keys(layoutFlow(compile(CHAIN), "F").positions).sort()).toEqual([
      "A", "B", "S",
    ]);
  });

  it("lays the chain out left to right", () => {
    const { positions } = layoutFlow(compile(CHAIN), "F");
    expect(positions.S!.x).toBeLessThan(positions.A!.x);
    expect(positions.A!.x).toBeLessThan(positions.B!.x);
  });

  it("returns an empty result for an unknown flow id", () => {
    expect(layoutFlow(compile(CHAIN), "nope")).toEqual({ positions: {}, width: 0, height: 0 });
  });

  it("returns an empty result for a flow with no edges", () => {
    const ir = compile("service A {}\nflow F {}");
    expect(layoutFlow(ir, "F")).toEqual({ positions: {}, width: 0, height: 0 });
  });

  it("does not overlap siblings that share a rank", () => {
    const ir = compile("service A {}\nservice B {}\nservice C {}\nflow F {\n  A -> B\n  A -> C\n}");
    const { positions } = layoutFlow(ir, "F");
    expect(Math.abs(positions.B!.y - positions.C!.y)).toBeGreaterThanOrEqual(
      sizeOf("service").height,
    );
  });

  it("gives a screen node more height than other kinds", () => {
    expect(sizeOf("screen").height).toBeGreaterThan(sizeOf("service").height);
  });

  it("falls back to the default size for an unregistered kind", () => {
    expect(sizeOf("totally-unknown")).toEqual(sizeOf("service"));
  });

  it("reports a bounding box that contains every node", () => {
    const ir = compile(CHAIN);
    const { positions, width, height } = layoutFlow(ir, "F");
    for (const [id, point] of Object.entries(positions)) {
      const kind = ir.nodes.find((node) => node.id === id)?.kind ?? "service";
      expect(point.x + sizeOf(kind).width).toBeLessThanOrEqual(width);
      expect(point.y + sizeOf(kind).height).toBeLessThanOrEqual(height);
    }
  });

  it("handles a cycle without hanging", () => {
    const ir = compile("service A {}\nservice B {}\nflow F {\n  A -> B\n  B -> A\n}");
    expect(Object.keys(layoutFlow(ir, "F").positions).sort()).toEqual(["A", "B"]);
  });

  it("is deterministic", () => {
    const ir = compile(CHAIN);
    expect(layoutFlow(ir, "F")).toEqual(layoutFlow(ir, "F"));
  });
});
```

`packages/layout/src/er-layout.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { compile } from "@flow/lang";
import type { ErModelArtifact } from "@flow/lang";
import { ER_TABLE_WIDTH, erTableHeight, layoutErModel } from "./er-layout";

const model = (): ErModelArtifact => {
  const ir = compile(
    "db D {\n" +
      "  table campaign {\n    id bigint [pk]\n    name varchar(244)\n  }\n" +
      "  table order {\n    id bigint [pk]\n    campaign_id bigint [fk]\n  }\n" +
      "  ref: order.campaign_id > campaign.id\n}",
  );
  return ir.nodes[0]?.artifacts[0] as ErModelArtifact;
};

describe("layoutErModel", () => {
  it("positions every table", () => {
    expect(Object.keys(layoutErModel(model()).positions).sort()).toEqual(["campaign", "order"]);
  });

  it("puts the referenced table downstream of the referencing one", () => {
    const { positions } = layoutErModel(model());
    expect(positions.order!.x).toBeLessThan(positions.campaign!.x);
  });

  it("sizes a table by its field count", () => {
    expect(erTableHeight(2)).toBeLessThan(erTableHeight(5));
  });

  it("returns an empty result for a model with no tables", () => {
    expect(layoutErModel({ kind: "er-model", tables: [], refs: [] })).toEqual({
      positions: {},
      width: 0,
      height: 0,
    });
  });

  it("lays out tables that have no refs at all", () => {
    const result = layoutErModel({
      kind: "er-model",
      tables: [
        { name: "a", fields: [] },
        { name: "b", fields: [] },
      ],
      refs: [],
    });
    expect(Object.keys(result.positions)).toHaveLength(2);
    expect(result.width).toBeGreaterThanOrEqual(ER_TABLE_WIDTH);
  });

  it("ignores a ref that names a missing table", () => {
    const result = layoutErModel({
      kind: "er-model",
      tables: [{ name: "a", fields: [] }],
      refs: [{ fromTable: "a", fromField: "x", toTable: "ghost", toField: "y", op: ">" }],
    });
    expect(Object.keys(result.positions)).toEqual(["a"]);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm vitest run --project layout`
Expected: FAIL — unresolved imports.

- [ ] **Step 4: Write the flow layout**

`packages/layout/src/flow-layout.ts`:

```ts
import dagre from "@dagrejs/dagre";
import type { DiagramIR } from "@flow/lang";

export interface NodeSize {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface LayoutResult {
  /** Top-left corner of each node, keyed by node id. */
  positions: Record<string, Point>;
  width: number;
  height: number;
}

/** A screen is taller because its card shows a mockup thumbnail. */
export const NODE_SIZE: Record<string, NodeSize> = {
  screen: { width: 260, height: 188 },
  default: { width: 260, height: 116 },
};

const MARGIN = 40;

export function sizeOf(kind: string): NodeSize {
  return NODE_SIZE[kind] ?? (NODE_SIZE.default as NodeSize);
}

export function layoutFlow(ir: DiagramIR, flowId: string): LayoutResult {
  const flow = ir.flows.find((candidate) => candidate.id === flowId);
  if (!flow) return { positions: {}, width: 0, height: 0 };

  const touched = new Set<string>();
  for (const edge of flow.edges) {
    touched.add(edge.from);
    touched.add(edge.to);
  }
  const nodes = ir.nodes.filter((node) => touched.has(node.id));
  if (nodes.length === 0) return { positions: {}, width: 0, height: 0 };

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "LR", nodesep: 48, ranksep: 96, marginx: MARGIN, marginy: MARGIN });
  graph.setDefaultEdgeLabel(() => ({}));

  const kinds = new Map(nodes.map((node) => [node.id, node.kind]));
  for (const node of nodes) graph.setNode(node.id, { ...sizeOf(node.kind) });
  for (const edge of flow.edges) {
    if (kinds.has(edge.from) && kinds.has(edge.to)) graph.setEdge(edge.from, edge.to);
  }

  dagre.layout(graph);

  const positions: Record<string, Point> = {};
  let width = 0;
  let height = 0;

  for (const id of graph.nodes()) {
    const laid = graph.node(id) as { x: number; y: number } | undefined;
    if (!laid) continue;
    const size = sizeOf(kinds.get(id) ?? "default");
    // dagre reports centres; every consumer wants a top-left corner.
    const point: Point = { x: laid.x - size.width / 2, y: laid.y - size.height / 2 };
    positions[id] = point;
    width = Math.max(width, point.x + size.width + MARGIN);
    height = Math.max(height, point.y + size.height + MARGIN);
  }

  return { positions, width, height };
}
```

- [ ] **Step 5: Write the ER layout**

`packages/layout/src/er-layout.ts`:

```ts
import dagre from "@dagrejs/dagre";
import type { ErModelArtifact } from "@flow/lang";
import type { LayoutResult, Point } from "./flow-layout";

export const ER_TABLE_WIDTH = 250;
export const ER_HEADER_HEIGHT = 36;
export const ER_ROW_HEIGHT = 26;
const MARGIN = 24;

export function erTableHeight(fieldCount: number): number {
  return ER_HEADER_HEIGHT + fieldCount * ER_ROW_HEIGHT;
}

export function layoutErModel(model: ErModelArtifact): LayoutResult {
  if (model.tables.length === 0) return { positions: {}, width: 0, height: 0 };

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "LR", nodesep: 32, ranksep: 80, marginx: MARGIN, marginy: MARGIN });
  graph.setDefaultEdgeLabel(() => ({}));

  const heights = new Map<string, number>();
  for (const table of model.tables) {
    const height = erTableHeight(table.fields.length);
    heights.set(table.name, height);
    graph.setNode(table.name, { width: ER_TABLE_WIDTH, height });
  }
  for (const ref of model.refs) {
    if (heights.has(ref.fromTable) && heights.has(ref.toTable)) {
      graph.setEdge(ref.fromTable, ref.toTable);
    }
  }

  dagre.layout(graph);

  const positions: Record<string, Point> = {};
  let width = 0;
  let height = 0;

  for (const id of graph.nodes()) {
    const laid = graph.node(id) as { x: number; y: number } | undefined;
    if (!laid) continue;
    const tableHeight = heights.get(id) ?? ER_HEADER_HEIGHT;
    const point: Point = { x: laid.x - ER_TABLE_WIDTH / 2, y: laid.y - tableHeight / 2 };
    positions[id] = point;
    width = Math.max(width, point.x + ER_TABLE_WIDTH + MARGIN);
    height = Math.max(height, point.y + tableHeight + MARGIN);
  }

  return { positions, width, height };
}
```

- [ ] **Step 6: Write the barrel file**

`packages/layout/src/index.ts`:

```ts
export { layoutFlow, sizeOf, NODE_SIZE } from "./flow-layout";
export type { LayoutResult, NodeSize, Point } from "./flow-layout";
export {
  layoutErModel,
  erTableHeight,
  ER_TABLE_WIDTH,
  ER_HEADER_HEIGHT,
  ER_ROW_HEIGHT,
} from "./er-layout";
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm vitest run --project layout`
Expected: PASS, 16 tests.

Run: `pnpm test`
Expected: both projects green.

- [ ] **Step 8: Commit**

```bash
git add packages/layout
git commit -m "feat(layout): add dagre-backed flow and ER layout"
```

---

## Task 8: Next.js app scaffold, theme tokens and kind metadata

Creates the app, wires the workspace packages into it, and establishes the visual vocabulary — one CSS custom property per node kind — that every later UI task reads from. No product behaviour yet; the deliverable is a page that boots and shows the palette.

**Files:**
- Create: `apps/web/package.json`, `apps/web/next.config.ts`, `apps/web/tsconfig.json`, `apps/web/postcss.config.mjs`, `apps/web/components.json`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/app/globals.css`, `apps/web/src/lib/utils.ts`, `apps/web/src/lib/kind-styles.ts`, `apps/web/src/lib/sample-diagram.ts`, `apps/web/src/components/theme-provider.tsx`, `apps/web/vitest.setup.ts`
- Modify: `vitest.workspace.ts` (add the `web` project)
- Test: `apps/web/src/lib/kind-styles.test.ts`

**Interfaces:**
- Consumes: `defaultRegistry` from `@flow/lang`.
- Produces:
  - `interface KindMeta { key: string; label: string; color: string; Icon: LucideIcon }`
  - `function kindMeta(kind: string): KindMeta`
  - `const KIND_ORDER: string[]` — legend order: `screen`, `service`, `http`, `db`, `topic`
  - `const SAMPLE_DIAGRAM: string`
  - `function cn(...inputs: ClassValue[]): string`

- [ ] **Step 1: Create the Next.js app**

```bash
pnpm dlx create-next-app@latest apps/web \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-pnpm --no-turbopack --yes
```

If the generator asks anything interactive, accept the defaults shown above. Then set the package name and add the workspace dependencies.

`apps/web/package.json` — replace `"name"` and merge these entries into the existing `dependencies`/`scripts`:

```json
{
  "name": "@flow/web",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@flow/lang": "workspace:*",
    "@flow/layout": "workspace:*"
  }
}
```

- [ ] **Step 2: Install the runtime dependencies**

```bash
pnpm --filter @flow/web add \
  @xyflow/react zustand next-themes lucide-react \
  @codemirror/state @codemirror/view @codemirror/language @codemirror/commands \
  @codemirror/lint @codemirror/theme-one-dark

pnpm --filter @flow/web add -D \
  @vitejs/plugin-react @testing-library/react @testing-library/user-event \
  @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Let Next transpile the workspace packages**

`apps/web/next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The workspace packages ship TypeScript source, not built output.
  transpilePackages: ["@flow/lang", "@flow/layout"],
};

export default nextConfig;
```

- [ ] **Step 4: Add shadcn/ui and the primitives this app needs**

```bash
cd apps/web
pnpm dlx shadcn@latest init -d
pnpm dlx shadcn@latest add button dialog badge separator resizable scroll-area tooltip
cd ../..
```

Expected: `apps/web/src/components/ui/` now contains `button.tsx`, `dialog.tsx`, `badge.tsx`, `separator.tsx`, `resizable.tsx`, `scroll-area.tsx`, `tooltip.tsx`, and `apps/web/src/lib/utils.ts` exports `cn`.

- [ ] **Step 5: Add the kind colour tokens**

Append to `apps/web/src/app/globals.css`, after whatever shadcn generated:

```css
/* Node kind palette, carried over from the approved design mockup. */
:root {
  --kind-screen: oklch(0.58 0.11 300);
  --kind-service: oklch(0.55 0.1 262);
  --kind-http: oklch(0.55 0.11 150);
  --kind-db: oklch(0.52 0.1 226);
  --kind-topic: oklch(0.58 0.13 24);
  --kind-default: oklch(0.55 0.02 250);
  --canvas-dot: oklch(0.88 0.006 250);
}

.dark {
  --kind-screen: oklch(0.72 0.12 300);
  --kind-service: oklch(0.7 0.11 262);
  --kind-http: oklch(0.72 0.12 150);
  --kind-db: oklch(0.68 0.11 226);
  --kind-topic: oklch(0.72 0.14 24);
  --kind-default: oklch(0.7 0.02 250);
  --canvas-dot: oklch(0.32 0.008 250);
}

html,
body {
  height: 100%;
  overflow: hidden;
}
```

- [ ] **Step 6: Write the failing test for kind metadata**

`apps/web/src/lib/kind-styles.test.ts`:

```ts
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
```

- [ ] **Step 7: Register the web project with Vitest**

Replace `vitest.workspace.ts` at the repo root:

```ts
import react from "@vitejs/plugin-react";
import { defineWorkspace } from "vitest/config";
import path from "node:path";

export default defineWorkspace([
  {
    test: {
      name: "lang",
      root: "./packages/lang",
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
  },
  {
    test: {
      name: "layout",
      root: "./packages/layout",
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
  },
  {
    plugins: [react()],
    resolve: {
      alias: { "@": path.resolve(process.cwd(), "apps/web/src") },
    },
    test: {
      name: "web",
      root: "./apps/web",
      environment: "jsdom",
      globals: true,
      setupFiles: ["./vitest.setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
    },
  },
]);
```

`apps/web/vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `pnpm vitest run --project web`
Expected: FAIL — `Failed to resolve import "./kind-styles"`.

- [ ] **Step 9: Write the kind metadata**

`apps/web/src/lib/kind-styles.ts`:

```ts
import { defaultRegistry } from "@flow/lang";
import { Boxes, Database, Globe, MonitorSmartphone, Radio, Server } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface KindMeta {
  key: string;
  /** Uppercase badge text. Comes from the language registry. */
  label: string;
  /** A CSS var() reference, so light and dark themes swap automatically. */
  color: string;
  Icon: LucideIcon;
}

/** Legend order, and the order kinds appear in any kind-grouped list. */
export const KIND_ORDER = ["screen", "service", "http", "db", "topic"];

const ICONS: Record<string, LucideIcon> = {
  screen: MonitorSmartphone,
  service: Server,
  http: Globe,
  db: Database,
  topic: Radio,
};

const FALLBACK: KindMeta = {
  key: "default",
  label: "COMPONENT",
  color: "var(--kind-default)",
  Icon: Boxes,
};

/**
 * Never throws for an unknown kind. A node type the UI has not been taught
 * about must still render — that is what keeps the canvas open to extension.
 */
export function kindMeta(kind: string): KindMeta {
  const def = defaultRegistry.get(kind);
  const Icon = ICONS[kind];
  if (!def || !Icon) return FALLBACK;
  return { key: kind, label: def.label, color: `var(--kind-${kind})`, Icon };
}
```

- [ ] **Step 10: Write the sample diagram**

`apps/web/src/lib/sample-diagram.ts` — this is what a first-time visitor sees, so it has to demonstrate every node kind and more than one flow:

```ts
export const SAMPLE_DIAGRAM = `# Flow Diagram — describe a use case end to end.
# Components first, then one flow per scenario.

screen MyOrders "My Orders" {
  desc: "Order list with filters for client, period and integration status"
}

http GetOrders "GET /v1/orders" {
  method: GET
  path: /v1/orders
  desc: "Returns a page of orders matching the filters from the screen"
  response {
    status: 200
    payload: \`{
  "data": [
    { "checkout": "556893", "client": "SUPER MUFFATO", "status": "pending" }
  ],
  "page": 1,
  "total": 128
}\`
  }
}

service OrderService "Order Service" {
  desc: "Orchestrates order creation, lookup and integration"
}

db OrdersDB "Orders Database" {
  desc: "Source of truth for campaigns, orders and line items"
  table campaign {
    id bigint [pk]
    code varchar(10) [not null]
    name varchar(244) [not null]
  }
  table order {
    id bigint [pk]
    campaign_id bigint [fk]
    status varchar(32) [not null]
    gross_value decimal(12,2)
  }
  table line_item {
    id bigint [pk]
    order_id bigint [fk]
    quantity int [not null]
  }
  ref: order.campaign_id > campaign.id
  ref: line_item.order_id > order.id
}

topic OrderEvents "order.events" {
  broker: kafka
  desc: "Status changes published for downstream consumers"
  payload: \`{
  "event_id": "evt_9f21",
  "type": "order.status_changed",
  "order_id": 556893,
  "status": "received"
}\`
}

service IntegrationService "Integration Service" {
  desc: "Consumes events and syncs orders with partner systems"
}

http SyncOrder "POST /crm/orders" {
  method: POST
  path: /crm/orders
  desc: "Pushes a synced order to the partner CRM"
  request {
    payload: \`{
  "order_id": 556893,
  "client": "SUPER MUFFATO",
  "gross_value": 625255.36
}\`
  }
  response {
    status: 200
    payload: \`{ "crm_id": "CRM-88421", "status": "synced" }\`
  }
}

service PartnerCRM "Partner CRM" {
  external: true
  desc: "Third-party CRM that receives the synced orders"
}

flow Lookup "Order lookup" {
  MyOrders -> GetOrders : "request"
  GetOrders -> OrderService
  OrderService -> OrdersDB : "query"
}

flow CrmSync "CRM synchronisation" {
  OrderService -> OrderEvents : "publish"
  OrderEvents -> IntegrationService : "consume"
  IntegrationService -> SyncOrder
  SyncOrder -> PartnerCRM : "sync"
}
`;
```

- [ ] **Step 11: Wire the theme provider and a placeholder page**

`apps/web/src/components/theme-provider.tsx`:

```tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

`apps/web/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flow Diagram",
  description: "Map a software use case end to end, code-first.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

`apps/web/src/app/page.tsx` — a temporary palette check, replaced in Task 13:

```tsx
import { KIND_ORDER, kindMeta } from "@/lib/kind-styles";

export default function Page() {
  return (
    <main className="flex h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-lg font-semibold">Flow Diagram</h1>
      <div className="flex gap-4">
        {KIND_ORDER.map((kind) => {
          const meta = kindMeta(kind);
          return (
            <div key={kind} className="flex items-center gap-2 text-xs">
              <span className="size-3 rounded-sm" style={{ background: meta.color }} />
              <meta.Icon className="size-3.5" />
              {meta.label}
            </div>
          );
        })}
      </div>
    </main>
  );
}
```

- [ ] **Step 12: Verify**

Run: `pnpm vitest run --project web`
Expected: PASS, 4 tests.

Run: `pnpm --filter @flow/web dev` and open http://localhost:3000
Expected: five coloured kind chips with icons. Stop the server.

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat(web): scaffold Next.js app with theme tokens and kind metadata"
```

---

## Task 9: Studio store

All app state in one Zustand store, with the "keep the last valid diagram" rule that stops the canvas flashing empty between keystrokes. Pure enough to test properly, so it is tested first.

**Files:**
- Create: `apps/web/src/store/studio-store.ts`
- Test: `apps/web/src/store/studio-store.test.ts`

**Interfaces:**
- Consumes: `compile`, `EMPTY_IR`, `DiagramIR` from `@flow/lang`; `SAMPLE_DIAGRAM` from Task 8.
- Produces:
  - `interface Point { x: number; y: number }`
  - `function isRenderable(ir: DiagramIR): boolean`
  - `const useStudioStore` — a Zustand store with:
    - state: `source: string`, `ir: DiagramIR`, `lastValidIr: DiagramIR`, `activeFlowId: string | null`, `selectedNodeId: string | null`, `manualPositions: Record<string, Point>`, `screenImages: Record<string, string>`
    - actions: `setSource(source: string)`, `setActiveFlow(flowId: string)`, `selectNode(nodeId: string | null)`, `setNodePosition(nodeId: string, position: Point)`, `resetLayout()`, `setScreenImage(nodeId: string, dataUrl: string)`
  - `function selectDisplayIr(state): DiagramIR` — the IR the canvas should draw
  - `function selectIsStale(state): boolean` — true when the canvas is showing an older IR
  - `const STORAGE_KEY = 'flow-diagram-studio'`

- [ ] **Step 1: Write the failing test**

`apps/web/src/store/studio-store.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { SAMPLE_DIAGRAM } from "@/lib/sample-diagram";
import {
  isRenderable,
  selectDisplayIr,
  selectIsStale,
  useStudioStore,
} from "./studio-store";

const reset = () => {
  useStudioStore.getState().setSource(SAMPLE_DIAGRAM);
  useStudioStore.setState({ manualPositions: {}, screenImages: {}, selectedNodeId: null });
};

beforeEach(reset);

describe("initial state", () => {
  it("starts on the sample diagram with its first flow active", () => {
    const state = useStudioStore.getState();
    expect(state.ir.nodes.length).toBeGreaterThan(0);
    expect(state.activeFlowId).toBe(state.ir.flows[0]?.id);
  });

  it("compiles the sample diagram without errors", () => {
    expect(useStudioStore.getState().ir.diagnostics).toEqual([]);
  });
});

describe("setSource", () => {
  it("recompiles on every change", () => {
    useStudioStore.getState().setSource('service Solo "Solo" {}\nflow F {\n  Solo -> Solo\n}');
    expect(useStudioStore.getState().ir.nodes.map((n) => n.id)).toEqual(["Solo"]);
  });

  it("keeps the active flow when it still exists", () => {
    const { setSource } = useStudioStore.getState();
    setSource("service A {}\nflow One {\n  A -> A\n}\nflow Two {\n  A -> A\n}");
    useStudioStore.getState().setActiveFlow("Two");
    setSource("service A {}\nservice B {}\nflow One {\n  A -> A\n}\nflow Two {\n  A -> B\n}");
    expect(useStudioStore.getState().activeFlowId).toBe("Two");
  });

  it("falls back to the first flow when the active one disappears", () => {
    const { setSource } = useStudioStore.getState();
    setSource("service A {}\nflow One {\n  A -> A\n}\nflow Two {\n  A -> A\n}");
    useStudioStore.getState().setActiveFlow("Two");
    setSource("service A {}\nflow One {\n  A -> A\n}");
    expect(useStudioStore.getState().activeFlowId).toBe("One");
  });
});

describe("last valid diagram", () => {
  it("treats a compiled diagram with nodes and flows as renderable", () => {
    expect(isRenderable(useStudioStore.getState().ir)).toBe(true);
  });

  it("does not treat a syntax error as renderable", () => {
    useStudioStore.getState().setSource("service A {\nflow");
    expect(isRenderable(useStudioStore.getState().ir)).toBe(false);
  });

  it("keeps drawing the last valid diagram while the source is broken", () => {
    const before = selectDisplayIr(useStudioStore.getState());
    useStudioStore.getState().setSource("service A {");
    expect(selectDisplayIr(useStudioStore.getState())).toBe(before);
    expect(selectIsStale(useStudioStore.getState())).toBe(true);
  });

  it("goes back to the live diagram once the source is valid again", () => {
    useStudioStore.getState().setSource("service A {");
    useStudioStore.getState().setSource("service A {}\nflow F {\n  A -> A\n}");
    const state = useStudioStore.getState();
    expect(selectDisplayIr(state)).toBe(state.ir);
    expect(selectIsStale(state)).toBe(false);
  });

  it("is not stale before anything valid has ever compiled", () => {
    useStudioStore.setState({ lastValidIr: { version: 1, nodes: [], flows: [], diagnostics: [] } });
    useStudioStore.getState().setSource("!!!");
    expect(selectIsStale(useStudioStore.getState())).toBe(false);
  });
});

describe("canvas interactions", () => {
  it("records a manual node position", () => {
    useStudioStore.getState().setNodePosition("MyOrders", { x: 10, y: 20 });
    expect(useStudioStore.getState().manualPositions.MyOrders).toEqual({ x: 10, y: 20 });
  });

  it("clears manual positions on reset", () => {
    useStudioStore.getState().setNodePosition("MyOrders", { x: 10, y: 20 });
    useStudioStore.getState().resetLayout();
    expect(useStudioStore.getState().manualPositions).toEqual({});
  });

  it("selects and clears a node", () => {
    useStudioStore.getState().selectNode("MyOrders");
    expect(useStudioStore.getState().selectedNodeId).toBe("MyOrders");
    useStudioStore.getState().selectNode(null);
    expect(useStudioStore.getState().selectedNodeId).toBeNull();
  });

  it("stores a pasted screen image outside the DSL text", () => {
    useStudioStore.getState().setScreenImage("MyOrders", "data:image/png;base64,AAA");
    expect(useStudioStore.getState().screenImages.MyOrders).toBe("data:image/png;base64,AAA");
    expect(useStudioStore.getState().source).not.toContain("base64");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run --project web`
Expected: FAIL — `Failed to resolve import "./studio-store"`.

- [ ] **Step 3: Write the store**

`apps/web/src/store/studio-store.ts`:

```ts
"use client";

import { compile, type DiagramIR } from "@flow/lang";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SAMPLE_DIAGRAM } from "@/lib/sample-diagram";

export interface Point {
  x: number;
  y: number;
}

export const STORAGE_KEY = "flow-diagram-studio";

/**
 * Whether an IR is worth drawing. Warnings and unresolved references are fine —
 * a half-written diagram is still useful. Only a structurally broken parse is
 * not, and that is the case that makes the canvas blank mid-keystroke.
 */
export function isRenderable(ir: DiagramIR): boolean {
  if (ir.nodes.length === 0 || ir.flows.length === 0) return false;
  return !ir.diagnostics.some(
    (diagnostic) => diagnostic.code === "syntax-error" || diagnostic.code === "internal-error",
  );
}

export interface StudioState {
  source: string;
  /** Compiled from the current source, warts and all. Drives the editor gutter. */
  ir: DiagramIR;
  /** The most recent renderable IR. Drives the canvas when `ir` is unusable. */
  lastValidIr: DiagramIR;
  activeFlowId: string | null;
  selectedNodeId: string | null;
  manualPositions: Record<string, Point>;
  /** Pasted mockups, keyed by node id. Deliberately not part of the DSL text. */
  screenImages: Record<string, string>;

  setSource: (source: string) => void;
  setActiveFlow: (flowId: string) => void;
  selectNode: (nodeId: string | null) => void;
  setNodePosition: (nodeId: string, position: Point) => void;
  resetLayout: () => void;
  setScreenImage: (nodeId: string, dataUrl: string) => void;
}

const initialIr = compile(SAMPLE_DIAGRAM);

export const useStudioStore = create<StudioState>()(
  persist(
    (set) => ({
      source: SAMPLE_DIAGRAM,
      ir: initialIr,
      lastValidIr: initialIr,
      activeFlowId: initialIr.flows[0]?.id ?? null,
      selectedNodeId: null,
      manualPositions: {},
      screenImages: {},

      setSource: (source) =>
        set((state) => {
          const ir = compile(source);
          const renderable = isRenderable(ir);
          const lastValidIr = renderable ? ir : state.lastValidIr;
          const display = renderable ? ir : lastValidIr;
          const activeFlowId = display.flows.some((flow) => flow.id === state.activeFlowId)
            ? state.activeFlowId
            : (display.flows[0]?.id ?? null);
          return { source, ir, lastValidIr, activeFlowId };
        }),

      setActiveFlow: (flowId) => set({ activeFlowId: flowId, selectedNodeId: null }),

      selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

      setNodePosition: (nodeId, position) =>
        set((state) => ({ manualPositions: { ...state.manualPositions, [nodeId]: position } })),

      resetLayout: () => set({ manualPositions: {} }),

      setScreenImage: (nodeId, dataUrl) =>
        set((state) => ({ screenImages: { ...state.screenImages, [nodeId]: dataUrl } })),
    }),
    {
      name: STORAGE_KEY,
      // The IR is derived, so it is never persisted — it is recomputed on load.
      partialize: (state) => ({
        source: state.source,
        activeFlowId: state.activeFlowId,
        manualPositions: state.manualPositions,
        screenImages: state.screenImages,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setSource(state.source);
      },
    },
  ),
);

export function selectDisplayIr(state: StudioState): DiagramIR {
  return isRenderable(state.ir) ? state.ir : state.lastValidIr;
}

export function selectIsStale(state: StudioState): boolean {
  return !isRenderable(state.ir) && isRenderable(state.lastValidIr);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run --project web`
Expected: PASS, 17 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/store
git commit -m "feat(web): add studio store with last-valid-diagram fallback"
```

---

## Task 10: Editor pane

CodeMirror 6 with a language definition for the DSL and a linter fed from the compiler's diagnostics, so an error underlines the exact characters that caused it.

**Files:**
- Create: `apps/web/src/components/editor/flow-language.ts`, `apps/web/src/components/editor/flow-linter.ts`, `apps/web/src/components/editor/editor-pane.tsx`
- Test: `apps/web/src/components/editor/flow-linter.test.ts`

**Interfaces:**
- Consumes: `useStudioStore` (Task 9); `Diagnostic` from `@flow/lang`.
- Produces:
  - `const flowLanguage: StreamLanguage<FlowStreamState>`
  - `function toCodeMirrorDiagnostics(diagnostics: Diagnostic[], docLength: number): CmDiagnostic[]`
  - `function flowLinter(getDiagnostics: () => Diagnostic[]): Extension`
  - `function EditorPane(): JSX.Element`

- [ ] **Step 1: Write the failing test**

Only the diagnostic mapping is unit-tested. It is the part with real logic — clamping offsets against a document that may have shrunk since the last compile, which is exactly what happens when you select-all and delete.

`apps/web/src/components/editor/flow-linter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { compile } from "@flow/lang";
import { toCodeMirrorDiagnostics } from "./flow-linter";

describe("toCodeMirrorDiagnostics", () => {
  it("maps a diagnostic onto the characters that caused it", () => {
    const source = "lambda L {}";
    const [mapped] = toCodeMirrorDiagnostics(compile(source).diagnostics, source.length);
    expect(source.slice(mapped!.from, mapped!.to)).toBe("lambda");
  });

  it("carries the severity and the diagnostic code through", () => {
    const source = 'service S {\n  colour: "x"\n}';
    const [mapped] = toCodeMirrorDiagnostics(compile(source).diagnostics, source.length);
    expect(mapped?.severity).toBe("warning");
    expect(mapped?.source).toBe("unknown-prop");
  });

  it("clamps spans that fall outside a document that has since shrunk", () => {
    const diagnostics = compile("lambda LongName {}").diagnostics;
    for (const mapped of toCodeMirrorDiagnostics(diagnostics, 3)) {
      expect(mapped.from).toBeGreaterThanOrEqual(0);
      expect(mapped.to).toBeLessThanOrEqual(3);
      expect(mapped.from).toBeLessThanOrEqual(mapped.to);
    }
  });

  it("widens a zero-width span so it is still visible", () => {
    const mapped = toCodeMirrorDiagnostics(
      [{ severity: "error", code: "syntax-error", message: "x", span: { start: 2, end: 2, line: 1, col: 3 } }],
      10,
    );
    expect(mapped[0]?.to).toBeGreaterThan(mapped[0]!.from);
  });

  it("drops nothing and returns one entry per diagnostic", () => {
    const source = 'service S {\n  colour: "x"\n}\nlambda L {}';
    const diagnostics = compile(source).diagnostics;
    expect(toCodeMirrorDiagnostics(diagnostics, source.length)).toHaveLength(diagnostics.length);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run --project web`
Expected: FAIL — `Failed to resolve import "./flow-linter"`.

- [ ] **Step 3: Write the language definition**

`apps/web/src/components/editor/flow-language.ts`:

```ts
import { StreamLanguage, type StreamParser } from "@codemirror/language";

const NODE_KEYWORDS = new Set(["screen", "service", "http", "db", "topic", "flow"]);
const NESTED_KEYWORDS = new Set(["request", "response", "table", "ref"]);

interface FlowStreamState {
  /** A template literal can span many lines, so the mode has to remember. */
  inTemplate: boolean;
}

/** Consume up to the closing backtick on this line, if there is one. */
function consumeTemplate(stream: Parameters<StreamParser<FlowStreamState>["token"]>[0]): boolean {
  while (!stream.eol()) {
    if (stream.next() === "`") return true;
  }
  return false;
}

const parser: StreamParser<FlowStreamState> = {
  name: "flow",
  startState: () => ({ inTemplate: false }),
  token(stream, state) {
    if (state.inTemplate) {
      state.inTemplate = !consumeTemplate(stream);
      return "string";
    }
    if (stream.eatSpace()) return null;
    if (stream.match(/^(#|\/\/).*/)) return "comment";
    if (stream.match(/^"(?:[^"\\]|\\.)*"?/)) return "string";
    if (stream.match(/^`/)) {
      state.inTemplate = !consumeTemplate(stream);
      return "string";
    }
    if (stream.match(/^->/)) return "operator";
    if (stream.match(/^\[[^\]]*\]?/)) return "meta";
    if (stream.match(/^[0-9]+/)) return "number";
    if (stream.match(/^[A-Za-z_][A-Za-z0-9_]*/)) {
      const word = stream.current();
      if (NODE_KEYWORDS.has(word)) return "keyword";
      if (NESTED_KEYWORDS.has(word)) return "typeName";
      if (stream.peek() === ":") return "propertyName";
      return "variableName";
    }
    stream.next();
    return null;
  },
  languageData: { commentTokens: { line: "#" } },
};

export const flowLanguage = StreamLanguage.define(parser);
```

- [ ] **Step 4: Write the linter bridge**

`apps/web/src/components/editor/flow-linter.ts`:

```ts
import type { Diagnostic } from "@flow/lang";
import { linter, type Diagnostic as CmDiagnostic } from "@codemirror/lint";
import type { Extension } from "@codemirror/state";

/**
 * Diagnostics are produced from a debounced compile, so they can briefly
 * describe a document longer than the one on screen. Clamping is what stops
 * CodeMirror throwing a range error after a select-all-and-delete.
 */
export function toCodeMirrorDiagnostics(
  diagnostics: Diagnostic[],
  docLength: number,
): CmDiagnostic[] {
  return diagnostics.map((diagnostic) => {
    const from = Math.max(0, Math.min(diagnostic.span.start, docLength));
    const rawTo = Math.max(from, Math.min(diagnostic.span.end, docLength));
    const to = rawTo === from ? Math.min(from + 1, docLength) : rawTo;
    return {
      from,
      to,
      severity: diagnostic.severity,
      message: diagnostic.message,
      source: diagnostic.code,
    };
  });
}

export function flowLinter(getDiagnostics: () => Diagnostic[]): Extension {
  return linter(
    (view) => toCodeMirrorDiagnostics(getDiagnostics(), view.state.doc.length),
    // Slightly longer than the store's compile debounce, so the underlines the
    // user sees always match the diagnostics the store currently holds.
    { delay: 250 },
  );
}
```

- [ ] **Step 5: Write the editor component**

`apps/web/src/components/editor/editor-pane.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  bracketMatching,
  defaultHighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { lintGutter } from "@codemirror/lint";
import { EditorState } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, highlightActiveLine, keymap, lineNumbers } from "@codemirror/view";
import { useTheme } from "next-themes";
import { useStudioStore } from "@/store/studio-store";
import { flowLanguage } from "./flow-language";
import { flowLinter } from "./flow-linter";

const COMPILE_DEBOUNCE_MS = 150;

const baseTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "12.5px" },
  ".cm-scroller": {
    fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
    lineHeight: "1.7",
  },
  ".cm-content": { padding: "14px 0" },
  "&.cm-focused": { outline: "none" },
});

export function EditorPane() {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { resolvedTheme } = useTheme();

  // Mount once. The store is read through getState() so the effect never needs
  // to re-run when state changes — CodeMirror owns its own document.
  useEffect(() => {
    if (!host.current) return;

    const onChange = EditorView.updateListener.of((update) => {
      if (!update.docChanged) return;
      const next = update.state.doc.toString();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        useStudioStore.getState().setSource(next);
      }, COMPILE_DEBOUNCE_MS);
    });

    const extensions = [
      lineNumbers(),
      lintGutter(),
      history(),
      indentOnInput(),
      bracketMatching(),
      highlightActiveLine(),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      flowLanguage,
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      flowLinter(() => useStudioStore.getState().ir.diagnostics),
      baseTheme,
      EditorView.lineWrapping,
      onChange,
    ];

    view.current = new EditorView({
      state: EditorState.create({
        doc: useStudioStore.getState().source,
        extensions: resolvedTheme === "dark" ? [...extensions, oneDark] : extensions,
      }),
      parent: host.current,
    });

    return () => {
      if (timer.current) clearTimeout(timer.current);
      view.current?.destroy();
      view.current = null;
    };
  }, [resolvedTheme]);

  // Replace the document when the source changes from outside the editor —
  // importing a file, for example. Guarded so typing never loops.
  useEffect(
    () =>
      useStudioStore.subscribe((state) => {
        const editor = view.current;
        if (!editor) return;
        if (editor.state.doc.toString() === state.source) return;
        editor.dispatch({
          changes: { from: 0, to: editor.state.doc.length, insert: state.source },
        });
      }),
    [],
  );

  return <div ref={host} className="h-full overflow-hidden" data-testid="editor-pane" />;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm vitest run --project web`
Expected: PASS, 22 tests.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/editor
git commit -m "feat(web): add CodeMirror editor with DSL highlighting and inline diagnostics"
```

---

## Task 11: Canvas pane and node cards

React Flow renders one card component per node kind, with a fallback that keeps an unknown kind from breaking the canvas.

**Files:**
- Create: `apps/web/src/components/canvas/node-shell.tsx`, `screen-node.tsx`, `service-node.tsx`, `http-node.tsx`, `db-node.tsx`, `topic-node.tsx`, `fallback-node.tsx`, `node-types.ts`, `canvas-controls.tsx`, `canvas-pane.tsx` (all under `apps/web/src/components/canvas/`)
- Create: `apps/web/src/lib/http-colors.ts`
- Test: `apps/web/src/components/canvas/node-types.test.tsx`

**Interfaces:**
- Consumes: `useStudioStore`, `selectDisplayIr` (Task 9); `layoutFlow`, `sizeOf` (Task 7); `kindMeta` (Task 8); `IRNode` from `@flow/lang`.
- Produces:
  - `interface FlowNodeData extends Record<string, unknown> { node: IRNode }`
  - `const nodeTypes: NodeTypes` — keys `screen`, `service`, `http`, `db`, `topic`, `fallback`
  - `function nodeTypeFor(kind: string): string`
  - `function methodColor(method: string): string`
  - `function CanvasPane(): JSX.Element`

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/canvas/node-types.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run --project web`
Expected: FAIL — `Failed to resolve import "./node-types"`.

- [ ] **Step 3: Write the HTTP method colours**

`apps/web/src/lib/http-colors.ts`:

```ts
const METHOD_COLORS: Record<string, string> = {
  GET: "oklch(0.55 0.11 150)",
  POST: "oklch(0.5 0.13 262)",
  PUT: "oklch(0.6 0.13 70)",
  PATCH: "oklch(0.55 0.1 300)",
  DELETE: "oklch(0.55 0.15 24)",
};

export function methodColor(method: string): string {
  return METHOD_COLORS[method.toUpperCase()] ?? "var(--kind-http)";
}

/** 2xx reads as success, 4xx/5xx as failure, anything else as neutral. */
export function statusColor(status: string): string {
  if (/^2/.test(status)) return "oklch(0.5 0.12 150)";
  if (/^[45]/.test(status)) return "oklch(0.55 0.15 24)";
  return "var(--kind-default)";
}
```

- [ ] **Step 4: Write the shared card shell**

`apps/web/src/components/canvas/node-shell.tsx`:

```tsx
"use client";

import { Handle, Position } from "@xyflow/react";
import type { ReactNode } from "react";
import { kindMeta } from "@/lib/kind-styles";
import { cn } from "@/lib/utils";

export function NodeShell({
  kind,
  selected,
  children,
}: {
  kind: string;
  selected?: boolean;
  children: ReactNode;
}) {
  const meta = kindMeta(kind);
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow",
        selected ? "ring-2 ring-offset-1 ring-offset-background" : "hover:shadow-md",
      )}
      style={selected ? ({ "--tw-ring-color": meta.color } as React.CSSProperties) : undefined}
    >
      <div className="h-1.5 shrink-0" style={{ background: meta.color }} />
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5 px-3 py-2">
        <div
          className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.08em]"
          style={{ color: meta.color }}
        >
          <meta.Icon className="size-3" aria-hidden />
          {meta.label}
        </div>
        {children}
      </div>
      <Handle type="target" position={Position.Left} className="!size-2 !border-0 !bg-muted-foreground" />
      <Handle type="source" position={Position.Right} className="!size-2 !border-0 !bg-muted-foreground" />
    </div>
  );
}

export function NodeTitle({ children }: { children: ReactNode }) {
  return <div className="truncate text-[13px] font-semibold leading-tight">{children}</div>;
}

export function NodeSubtitle({ children }: { children: ReactNode }) {
  return <div className="truncate text-[11px] text-muted-foreground">{children}</div>;
}
```

- [ ] **Step 5: Write the five card components plus the fallback**

`apps/web/src/components/canvas/screen-node.tsx`:

```tsx
"use client";

import type { NodeProps } from "@xyflow/react";
import { ImageIcon } from "lucide-react";
import { useStudioStore } from "@/store/studio-store";
import type { FlowNodeData } from "./node-types";
import { NodeShell, NodeTitle } from "./node-shell";

export function ScreenNode({ data, selected }: NodeProps & { data: FlowNodeData }) {
  const { node } = data;
  const pasted = useStudioStore((state) => state.screenImages[node.id]);
  const src = pasted ?? node.props.image;

  return (
    <NodeShell kind="screen" selected={selected}>
      <NodeTitle>{node.label}</NodeTitle>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md border border-dashed bg-muted/40">
        {src ? (
          // A data URL or an arbitrary remote mockup: next/image cannot help here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={node.label} className="h-full w-full object-cover" />
        ) : (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <ImageIcon className="size-3" aria-hidden />
            no mockup
          </span>
        )}
      </div>
    </NodeShell>
  );
}
```

`apps/web/src/components/canvas/service-node.tsx`:

```tsx
"use client";

import type { NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "./node-types";
import { NodeShell, NodeSubtitle, NodeTitle } from "./node-shell";

export function ServiceNode({ data, selected }: NodeProps & { data: FlowNodeData }) {
  const { node } = data;
  const isExternal = node.props.external === "true";

  return (
    <NodeShell kind="service" selected={selected}>
      <NodeTitle>{node.label}</NodeTitle>
      {node.props.desc ? <NodeSubtitle>{node.props.desc}</NodeSubtitle> : null}
      {isExternal ? (
        <span className="w-fit rounded border border-dashed px-1.5 py-px text-[9px] text-muted-foreground">
          external
        </span>
      ) : null}
    </NodeShell>
  );
}
```

`apps/web/src/components/canvas/http-node.tsx`:

```tsx
"use client";

import type { HttpExchangeArtifact } from "@flow/lang";
import type { NodeProps } from "@xyflow/react";
import { methodColor, statusColor } from "@/lib/http-colors";
import type { FlowNodeData } from "./node-types";
import { NodeShell, NodeTitle } from "./node-shell";

export function HttpNode({ data, selected }: NodeProps & { data: FlowNodeData }) {
  const { node } = data;
  const exchange = node.artifacts.find(
    (artifact): artifact is HttpExchangeArtifact => artifact.kind === "http-exchange",
  );

  return (
    <NodeShell kind="http" selected={selected}>
      {exchange ? (
        <div className="flex items-center gap-2">
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
            style={{ background: methodColor(exchange.method) }}
          >
            {exchange.method || "?"}
          </span>
          <span className="truncate font-mono text-[11px]">{exchange.path}</span>
        </div>
      ) : null}
      <NodeTitle>{node.label}</NodeTitle>
      {exchange?.response ? (
        <div className="flex items-center gap-1.5">
          <span
            className="size-1.5 rounded-full"
            style={{ background: statusColor(exchange.response.status) }}
          />
          <span className="text-[10px] text-muted-foreground">{exchange.response.status}</span>
        </div>
      ) : null}
    </NodeShell>
  );
}
```

`apps/web/src/components/canvas/db-node.tsx`:

```tsx
"use client";

import type { ErModelArtifact } from "@flow/lang";
import type { NodeProps } from "@xyflow/react";
import { Table2 } from "lucide-react";
import type { FlowNodeData } from "./node-types";
import { NodeShell, NodeSubtitle, NodeTitle } from "./node-shell";

export function DbNode({ data, selected }: NodeProps & { data: FlowNodeData }) {
  const { node } = data;
  const model = node.artifacts.find(
    (artifact): artifact is ErModelArtifact => artifact.kind === "er-model",
  );
  const count = model?.tables.length ?? 0;

  return (
    <NodeShell kind="db" selected={selected}>
      <NodeTitle>{node.label}</NodeTitle>
      <NodeSubtitle>
        <span className="flex items-center gap-1.5">
          <Table2 className="size-3" aria-hidden />
          {count} {count === 1 ? "table" : "tables"}
        </span>
      </NodeSubtitle>
    </NodeShell>
  );
}
```

`apps/web/src/components/canvas/topic-node.tsx`:

```tsx
"use client";

import type { NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "./node-types";
import { NodeShell, NodeSubtitle } from "./node-shell";

export function TopicNode({ data, selected }: NodeProps & { data: FlowNodeData }) {
  const { node } = data;
  return (
    <NodeShell kind="topic" selected={selected}>
      {/* A topic's name is its address, so it reads as code rather than prose. */}
      <div className="truncate font-mono text-[12.5px] font-semibold leading-tight">
        {node.label}
      </div>
      {node.props.broker ? (
        <span className="w-fit rounded border px-1.5 py-px text-[9px] uppercase text-muted-foreground">
          {node.props.broker}
        </span>
      ) : null}
      {node.props.desc ? <NodeSubtitle>{node.props.desc}</NodeSubtitle> : null}
    </NodeShell>
  );
}
```

`apps/web/src/components/canvas/fallback-node.tsx`:

```tsx
"use client";

import type { NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "./node-types";
import { NodeShell, NodeSubtitle, NodeTitle } from "./node-shell";

/**
 * Renders any kind the UI has not been taught about. A new node type added to
 * the language registry shows up here immediately rather than crashing the
 * canvas — the same open-for-extension rule the detail panel follows.
 */
export function FallbackNode({ data, selected }: NodeProps & { data: FlowNodeData }) {
  const { node } = data;
  return (
    <NodeShell kind={node.kind} selected={selected}>
      <NodeTitle>{node.label}</NodeTitle>
      <NodeSubtitle>{node.props.desc ?? node.kind}</NodeSubtitle>
    </NodeShell>
  );
}
```

`apps/web/src/components/canvas/node-types.ts`:

```ts
import type { IRNode } from "@flow/lang";
import type { NodeTypes } from "@xyflow/react";
import { DbNode } from "./db-node";
import { FallbackNode } from "./fallback-node";
import { HttpNode } from "./http-node";
import { ScreenNode } from "./screen-node";
import { ServiceNode } from "./service-node";
import { TopicNode } from "./topic-node";

export interface FlowNodeData extends Record<string, unknown> {
  node: IRNode;
}

/** Must be module-level and stable: React Flow re-mounts nodes otherwise. */
export const nodeTypes = {
  screen: ScreenNode,
  service: ServiceNode,
  http: HttpNode,
  db: DbNode,
  topic: TopicNode,
  fallback: FallbackNode,
} as unknown as NodeTypes;

export function nodeTypeFor(kind: string): string {
  return kind in nodeTypes ? kind : "fallback";
}
```

- [ ] **Step 6: Write the canvas controls**

`apps/web/src/components/canvas/canvas-controls.tsx`:

```tsx
"use client";

import { useReactFlow } from "@xyflow/react";
import { LayoutGrid, Maximize2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useStudioStore } from "@/store/studio-store";

export function CanvasControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const resetLayout = useStudioStore((state) => state.resetLayout);

  return (
    <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1 rounded-lg border bg-card p-1 shadow-md">
      <Button variant="ghost" size="icon" className="size-7" onClick={() => zoomOut()} aria-label="Zoom out">
        <Minus className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" className="size-7" onClick={() => zoomIn()} aria-label="Zoom in">
        <Plus className="size-4" />
      </Button>
      <Separator orientation="vertical" className="mx-1 h-4" />
      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => fitView({ padding: 0.2 })}>
        <Maximize2 className="mr-1 size-3.5" />
        Fit
      </Button>
      <Separator orientation="vertical" className="mx-1 h-4" />
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => {
          resetLayout();
          window.requestAnimationFrame(() => fitView({ padding: 0.2 }));
        }}
      >
        <LayoutGrid className="mr-1 size-3.5" />
        Re-layout
      </Button>
    </div>
  );
}
```

- [ ] **Step 7: Write the canvas pane**

`apps/web/src/components/canvas/canvas-pane.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { layoutFlow, sizeOf } from "@flow/layout";
import { kindMeta } from "@/lib/kind-styles";
import { selectDisplayIr, useStudioStore } from "@/store/studio-store";
import { CanvasControls } from "./canvas-controls";
import { nodeTypeFor, nodeTypes, type FlowNodeData } from "./node-types";
import "@xyflow/react/dist/style.css";

function CanvasInner() {
  const ir = useStudioStore(selectDisplayIr);
  const activeFlowId = useStudioStore((state) => state.activeFlowId);
  const manualPositions = useStudioStore((state) => state.manualPositions);
  const selectedNodeId = useStudioStore((state) => state.selectedNodeId);
  const selectNode = useStudioStore((state) => state.selectNode);
  const setNodePosition = useStudioStore((state) => state.setNodePosition);

  const layout = useMemo(() => layoutFlow(ir, activeFlowId ?? ""), [ir, activeFlowId]);

  const nodes = useMemo<Node<FlowNodeData>[]>(() => {
    return Object.keys(layout.positions).flatMap((id) => {
      const node = ir.nodes.find((candidate) => candidate.id === id);
      const auto = layout.positions[id];
      if (!node || !auto) return [];
      const size = sizeOf(node.kind);
      return [
        {
          id,
          type: nodeTypeFor(node.kind),
          position: manualPositions[id] ?? auto,
          data: { node },
          selected: selectedNodeId === id,
          style: { width: size.width, height: size.height },
        },
      ];
    });
  }, [ir, layout, manualPositions, selectedNodeId]);

  const edges = useMemo<Edge[]>(() => {
    const flow = ir.flows.find((candidate) => candidate.id === activeFlowId);
    if (!flow) return [];
    return flow.edges.map((edge, index) => ({
      id: `${edge.from}-${edge.to}-${index}`,
      source: edge.from,
      target: edge.to,
      label: edge.label,
      type: "smoothstep",
      animated: true,
      labelStyle: { fontSize: 10.5, fontWeight: 600 },
      labelBgStyle: { fill: "var(--card)" },
    }));
  }, [ir, activeFlowId]);

  const onNodesChange = (changes: NodeChange[]) => {
    for (const change of changes) {
      if (change.type === "position" && change.position && change.dragging === false) {
        setNodePosition(change.id, change.position);
      }
    }
  };

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={(_, node) => selectNode(node.id)}
        onPaneClick={() => selectNode(null)}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2.5}
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--canvas-dot)" />
        <MiniMap
          pannable
          zoomable
          className="!bottom-16 !right-4 !h-24 !w-40 rounded-lg border"
          nodeColor={(node) => kindMeta((node.data as FlowNodeData).node.kind).color}
        />
      </ReactFlow>
      <CanvasControls />
    </div>
  );
}

export function CanvasPane() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
```

- [ ] **Step 8: Verify**

Run: `pnpm vitest run --project web`
Expected: PASS, 24 tests.

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/canvas apps/web/src/lib/http-colors.ts
git commit -m "feat(web): add React Flow canvas with per-kind node cards"
```

---

## Task 12: Node detail dialog and artifact renderers

The dialog dispatches on **artifact kind**, not node kind. Adding a view later means adding a renderer to one map.

**Files:**
- Create: `apps/web/src/components/detail/json-code.tsx`, `json-payload-view.tsx`, `http-exchange-view.tsx`, `er-model-view.tsx`, `image-view.tsx`, `artifact-renderers.tsx`, `node-detail-dialog.tsx` (all under `apps/web/src/components/detail/`)
- Create: `apps/web/src/lib/svg-path.ts`
- Test: `apps/web/src/components/detail/artifact-renderers.test.tsx`

**Interfaces:**
- Consumes: `Artifact`, `ArtifactKind`, `HttpExchangeArtifact`, `ErModelArtifact`, `JsonPayloadArtifact`, `ImageArtifact`, `IRNode` from `@flow/lang`; `layoutErModel`, `erTableHeight`, `ER_TABLE_WIDTH`, `ER_HEADER_HEIGHT`, `ER_ROW_HEIGHT` from `@flow/layout`; `useStudioStore` (Task 9); `kindMeta` (Task 8); `methodColor`, `statusColor` (Task 11).
- Produces:
  - `function bezierPath(x1: number, y1: number, x2: number, y2: number): string`
  - `function formatJson(raw: string): string`
  - `function ArtifactView({ artifact }: { artifact: Artifact }): JSX.Element`
  - `const artifactRenderers: Record<ArtifactKind, (props: { artifact: Artifact }) => JSX.Element>`
  - `function NodeDetailDialog(): JSX.Element`

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/detail/artifact-renderers.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run --project web`
Expected: FAIL — `Failed to resolve import "./artifact-renderers"`.

- [ ] **Step 3: Write the JSON code block**

`apps/web/src/components/detail/json-code.tsx`:

```tsx
"use client";

import { Fragment, type ReactNode } from "react";

/** Pretty-print when possible; never throw on a payload that is not valid JSON. */
export function formatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

const TOKEN = /("(?:\\.|[^"\\])*"\s*:?|\b(?:true|false|null)\b|-?\d+\.?\d*)/g;

function colorFor(token: string): string {
  if (token.startsWith('"') && token.trimEnd().endsWith(":")) return "text-sky-300";
  if (token.startsWith('"')) return "text-emerald-300";
  return "text-orange-300";
}

function highlight(source: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  TOKEN.lastIndex = 0;

  while ((match = TOKEN.exec(source))) {
    if (match.index > last) parts.push(<Fragment key={`t${last}`}>{source.slice(last, match.index)}</Fragment>);
    parts.push(
      <span key={`m${match.index}`} className={colorFor(match[0])}>
        {match[0]}
      </span>,
    );
    last = match.index + match[0].length;
  }
  if (last < source.length) parts.push(<Fragment key="tail">{source.slice(last)}</Fragment>);
  return parts;
}

export function JsonCode({ json }: { json: string }) {
  return (
    <pre className="overflow-auto rounded-lg bg-zinc-900 p-4 font-mono text-[12px] leading-relaxed text-zinc-200">
      <code>{highlight(formatJson(json))}</code>
    </pre>
  );
}
```

- [ ] **Step 4: Write the simple views**

`apps/web/src/components/detail/json-payload-view.tsx`:

```tsx
"use client";

import type { JsonPayloadArtifact } from "@flow/lang";
import { JsonCode } from "./json-code";

export function JsonPayloadView({ artifact }: { artifact: JsonPayloadArtifact }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
        {artifact.title}
      </h3>
      <JsonCode json={artifact.json} />
    </section>
  );
}
```

`apps/web/src/components/detail/image-view.tsx`:

```tsx
"use client";

import type { ImageArtifact } from "@flow/lang";

export function ImageView({ artifact }: { artifact: ImageArtifact }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      {/* Arbitrary remote URLs and data URLs: next/image cannot help here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={artifact.src} alt={artifact.alt ?? "Screen mockup"} className="w-full object-contain" />
    </div>
  );
}
```

`apps/web/src/components/detail/http-exchange-view.tsx`:

```tsx
"use client";

import type { HttpExchangeArtifact } from "@flow/lang";
import { methodColor, statusColor } from "@/lib/http-colors";
import { JsonCode } from "./json-code";

export function HttpExchangeView({ artifact }: { artifact: HttpExchangeArtifact }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span
          className="rounded-md px-2.5 py-1 text-xs font-bold text-white"
          style={{ background: methodColor(artifact.method) }}
        >
          {artifact.method || "?"}
        </span>
        <span className="font-mono text-[13.5px]">{artifact.path}</span>
      </div>

      {artifact.request?.payload ? (
        <section className="space-y-2">
          <h3 className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
            Request body
          </h3>
          <JsonCode json={artifact.request.payload} />
        </section>
      ) : null}

      {artifact.response ? (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
              Response
            </h3>
            <span
              className="text-[10.5px] font-bold"
              style={{ color: statusColor(artifact.response.status) }}
            >
              {artifact.response.status}
            </span>
          </div>
          {artifact.response.payload ? <JsonCode json={artifact.response.payload} /> : null}
        </section>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Write the SVG path helper and the ER view**

`apps/web/src/lib/svg-path.ts`:

```ts
/**
 * Horizontal cubic bezier between two points. When the target sits to the left
 * of the source, the curve loops below so the line stays readable.
 */
export function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  if (x2 >= x1) {
    const dx = Math.max((x2 - x1) * 0.5, 50);
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  }
  const midY = Math.max(y1, y2) + 90;
  return `M ${x1} ${y1} C ${x1 + 80} ${y1}, ${x1 + 80} ${midY}, ${(x1 + x2) / 2} ${midY} S ${x2 - 80} ${y2}, ${x2} ${y2}`;
}
```

`apps/web/src/components/detail/er-model-view.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import type { ErModelArtifact } from "@flow/lang";
import {
  ER_HEADER_HEIGHT,
  ER_ROW_HEIGHT,
  ER_TABLE_WIDTH,
  erTableHeight,
  layoutErModel,
} from "@flow/layout";
import { bezierPath } from "@/lib/svg-path";

/** Vertical centre of a column row, relative to the table's top edge. */
function rowCentre(index: number): number {
  return ER_HEADER_HEIGHT + index * ER_ROW_HEIGHT + ER_ROW_HEIGHT / 2;
}

export function ErModelView({ artifact }: { artifact: ErModelArtifact }) {
  const layout = useMemo(() => layoutErModel(artifact), [artifact]);

  if (artifact.tables.length === 0) {
    return <p className="text-sm text-muted-foreground">This database declares no tables yet.</p>;
  }

  const columnIndex = (table: string, column: string) => {
    const found = artifact.tables.find((candidate) => candidate.name === table);
    const index = found?.fields.findIndex((field) => field.name === column) ?? -1;
    return index < 0 ? 0 : index;
  };

  return (
    <div className="overflow-auto">
      <div className="relative" style={{ width: layout.width, height: layout.height }}>
        <svg
          width={layout.width}
          height={layout.height}
          className="pointer-events-none absolute left-0 top-0 overflow-visible"
        >
          {artifact.refs.map((ref, index) => {
            const from = layout.positions[ref.fromTable];
            const to = layout.positions[ref.toTable];
            if (!from || !to) return null;
            const forward = to.x >= from.x;
            const x1 = forward ? from.x + ER_TABLE_WIDTH : from.x;
            const x2 = forward ? to.x : to.x + ER_TABLE_WIDTH;
            const y1 = from.y + rowCentre(columnIndex(ref.fromTable, ref.fromField));
            const y2 = to.y + rowCentre(columnIndex(ref.toTable, ref.toField));
            return (
              <g key={`${ref.fromTable}.${ref.fromField}-${index}`}>
                <path
                  d={bezierPath(x1, y1, x2, y2)}
                  fill="none"
                  stroke="var(--kind-db)"
                  strokeWidth={1.6}
                  opacity={0.75}
                />
                <text x={x1} y={y1 - 6} fontSize={10} fontWeight={600} fill="var(--kind-db)">
                  {ref.op.includes(">") ? "*" : "1"}
                </text>
                <text
                  x={x2}
                  y={y2 - 6}
                  fontSize={10}
                  fontWeight={600}
                  fill="var(--kind-db)"
                  textAnchor="end"
                >
                  {ref.op.includes("<") ? "*" : "1"}
                </text>
              </g>
            );
          })}
        </svg>

        {artifact.tables.map((table) => {
          const position = layout.positions[table.name];
          if (!position) return null;
          return (
            <div
              key={table.name}
              className="absolute overflow-hidden rounded-lg border bg-card shadow-sm"
              style={{
                left: position.x,
                top: position.y,
                width: ER_TABLE_WIDTH,
                height: erTableHeight(table.fields.length),
              }}
            >
              <div
                className="flex items-center px-3 text-[12.5px] font-semibold text-white"
                style={{ background: "var(--kind-db)", height: ER_HEADER_HEIGHT }}
              >
                {table.name}
              </div>
              {table.fields.map((field) => (
                <div
                  key={field.name}
                  className="flex items-center justify-between gap-2 border-b px-3 last:border-b-0"
                  style={{ height: ER_ROW_HEIGHT }}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    {field.pk ? (
                      <span className="rounded bg-primary/10 px-1 text-[8px] font-bold text-primary">PK</span>
                    ) : null}
                    {field.fk ? (
                      <span className="rounded bg-amber-500/15 px-1 text-[8px] font-bold text-amber-600">FK</span>
                    ) : null}
                    <span className="truncate font-mono text-[11.5px]">{field.name}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {field.type}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Write the renderer map**

`apps/web/src/components/detail/artifact-renderers.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";
import type {
  Artifact,
  ErModelArtifact,
  HttpExchangeArtifact,
  ImageArtifact,
  JsonPayloadArtifact,
} from "@flow/lang";
import { ErModelView } from "./er-model-view";
import { HttpExchangeView } from "./http-exchange-view";
import { ImageView } from "./image-view";
import { JsonPayloadView } from "./json-payload-view";

type Renderer<A extends Artifact> = (props: { artifact: A }) => ReactNode;

/**
 * The whole detail panel is this map. Node kinds do not appear anywhere in it:
 * a node's views come from the artifacts it carries, so a new view is a new
 * entry here and nothing else changes.
 */
export const artifactRenderers: {
  "http-exchange": Renderer<HttpExchangeArtifact>;
  "er-model": Renderer<ErModelArtifact>;
  "json-payload": Renderer<JsonPayloadArtifact>;
  image: Renderer<ImageArtifact>;
} = {
  "http-exchange": HttpExchangeView,
  "er-model": ErModelView,
  "json-payload": JsonPayloadView,
  image: ImageView,
};

/**
 * The compiler checks this switch for exhaustiveness: add a fifth artifact kind
 * to the language and this file stops compiling until it has a view.
 */
export function ArtifactView({ artifact }: { artifact: Artifact }): ReactNode {
  switch (artifact.kind) {
    case "http-exchange":
      return <HttpExchangeView artifact={artifact} />;
    case "er-model":
      return <ErModelView artifact={artifact} />;
    case "json-payload":
      return <JsonPayloadView artifact={artifact} />;
    case "image":
      return <ImageView artifact={artifact} />;
  }
}
```

Two exports, on purpose. `ArtifactView` is what the dialog calls; its `switch` is
what the compiler checks for exhaustiveness. `artifactRenderers` exists so the
coverage test can assert at runtime that no artifact kind is missing a view.

- [ ] **Step 7: Write the dialog**

`apps/web/src/components/detail/node-detail-dialog.tsx`:

```tsx
"use client";

import { useCallback, type ClipboardEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { kindMeta } from "@/lib/kind-styles";
import { selectDisplayIr, useStudioStore } from "@/store/studio-store";
import { ArtifactView } from "./artifact-renderers";

export function NodeDetailDialog() {
  const ir = useStudioStore(selectDisplayIr);
  const selectedNodeId = useStudioStore((state) => state.selectedNodeId);
  const selectNode = useStudioStore((state) => state.selectNode);
  const setScreenImage = useStudioStore((state) => state.setScreenImage);

  const node = selectedNodeId ? ir.nodes.find((candidate) => candidate.id === selectedNodeId) : undefined;

  const onPaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      if (!node || node.kind !== "screen") return;
      const file = Array.from(event.clipboardData.files)[0];
      if (!file || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") setScreenImage(node.id, reader.result);
      };
      reader.readAsDataURL(file);
    },
    [node, setScreenImage],
  );

  const meta = kindMeta(node?.kind ?? "");

  return (
    <Dialog open={Boolean(node)} onOpenChange={(open) => !open && selectNode(null)}>
      <DialogContent className="max-h-[86vh] max-w-3xl gap-0 overflow-hidden p-0" onPaste={onPaste}>
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b px-5 py-4">
          <span className="size-2.5 shrink-0 rounded-sm" style={{ background: meta.color }} />
          <div className="min-w-0">
            <div
              className="text-[10px] font-bold uppercase tracking-[0.06em]"
              style={{ color: meta.color }}
            >
              {meta.label}
            </div>
            <DialogTitle className="truncate text-lg">{node?.label ?? ""}</DialogTitle>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-5 px-5 py-5">
            {node?.props.desc ? (
              <p className="text-sm leading-relaxed text-muted-foreground">{node.props.desc}</p>
            ) : null}

            {node?.artifacts.map((artifact, index) => (
              <ArtifactView key={`${artifact.kind}-${index}`} artifact={artifact} />
            ))}

            {node && node.artifacts.length === 0 && !node.props.desc ? (
              <p className="text-sm text-muted-foreground">
                No details yet. Add properties to this component in the editor.
              </p>
            ) : null}

            {node?.kind === "screen" ? (
              <p className="text-xs text-muted-foreground">
                Paste an image here to attach a mockup, or set{" "}
                <code className="font-mono">image: &quot;https://…&quot;</code> in the editor.
              </p>
            ) : null}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm vitest run --project web`
Expected: PASS, 32 tests.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/detail apps/web/src/lib/svg-path.ts
git commit -m "feat(web): add node detail dialog with artifact-driven renderers"
```

---

## Task 13: Studio shell, flow tabs, legend, status bar and file I/O

Assembles the three zones into the real page and adds the surfaces that make the app usable: switching flows, reading the diagnostic count, and getting a diagram in and out as a file.

**Files:**
- Create: `apps/web/src/lib/file-io.ts`, `apps/web/src/components/studio/flow-tabs.tsx`, `legend.tsx`, `status-bar.tsx`, `io-buttons.tsx`, `theme-toggle.tsx`, `studio-header.tsx`, `studio-shell.tsx` (all under `apps/web/src/components/studio/`)
- Modify: `apps/web/src/app/page.tsx` (replace the Task 8 placeholder entirely)
- Test: `apps/web/src/components/studio/status-bar.test.tsx`

**Interfaces:**
- Consumes: `EditorPane` (Task 10), `CanvasPane` (Task 11), `NodeDetailDialog` (Task 12), `useStudioStore`, `selectDisplayIr`, `selectIsStale` (Task 9), `KIND_ORDER`, `kindMeta` (Task 8).
- Produces:
  - `function downloadText(filename: string, text: string): void`
  - `function readTextFile(file: File): Promise<string>`
  - `const FILE_EXTENSION = '.flow'`
  - `function StatusBar(): JSX.Element`
  - `function StudioShell(): JSX.Element`

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/studio/status-bar.test.tsx`:

```tsx
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SAMPLE_DIAGRAM } from "@/lib/sample-diagram";
import { useStudioStore } from "@/store/studio-store";
import { StatusBar } from "./status-bar";

beforeEach(() => {
  useStudioStore.getState().setSource(SAMPLE_DIAGRAM);
});

describe("StatusBar", () => {
  it("reports a clean diagram", () => {
    render(<StatusBar />);
    expect(screen.getByText(/no problems/i)).toBeInTheDocument();
  });

  it("counts errors and warnings separately", () => {
    useStudioStore
      .getState()
      .setSource('lambda L {}\nservice S {\n  colour: "x"\n}\nflow F {\n  S -> S\n}');
    render(<StatusBar />);
    expect(screen.getByText(/1 error/i)).toBeInTheDocument();
    expect(screen.getByText(/1 warning/i)).toBeInTheDocument();
  });

  it("pluralises counts", () => {
    useStudioStore.getState().setSource("lambda A {}\nlambda B {}\nservice S {}\nflow F {\n  S -> S\n}");
    render(<StatusBar />);
    expect(screen.getByText(/2 errors/i)).toBeInTheDocument();
  });

  it("says when the canvas is showing an older diagram", () => {
    useStudioStore.getState().setSource("service A {");
    render(<StatusBar />);
    expect(screen.getByText(/last valid diagram/i)).toBeInTheDocument();
  });

  it("reports the node and flow counts of what is on screen", () => {
    render(<StatusBar />);
    expect(screen.getByText(/8 components/i)).toBeInTheDocument();
    expect(screen.getByText(/2 flows/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run --project web`
Expected: FAIL — `Failed to resolve import "./status-bar"`.

- [ ] **Step 3: Write the file I/O helpers**

`apps/web/src/lib/file-io.ts`:

```ts
export const FILE_EXTENSION = ".flow";

export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file."));
    reader.readAsText(file);
  });
}
```

- [ ] **Step 4: Write the status bar**

`apps/web/src/components/studio/status-bar.tsx`:

```tsx
"use client";

import { AlertTriangle, CircleAlert, CircleCheck, History } from "lucide-react";
import { selectDisplayIr, selectIsStale, useStudioStore } from "@/store/studio-store";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export function StatusBar() {
  const diagnostics = useStudioStore((state) => state.ir.diagnostics);
  const displayIr = useStudioStore(selectDisplayIr);
  const isStale = useStudioStore(selectIsStale);

  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const warnings = diagnostics.length - errors;

  return (
    <div className="flex h-7 shrink-0 items-center gap-4 border-t bg-card px-4 text-[11px] text-muted-foreground">
      {errors === 0 && warnings === 0 ? (
        <span className="flex items-center gap-1.5">
          <CircleCheck className="size-3 text-emerald-500" aria-hidden />
          No problems
        </span>
      ) : (
        <span className="flex items-center gap-3">
          {errors > 0 ? (
            <span className="flex items-center gap-1.5 text-destructive">
              <CircleAlert className="size-3" aria-hidden />
              {plural(errors, "error")}
            </span>
          ) : null}
          {warnings > 0 ? (
            <span className="flex items-center gap-1.5 text-amber-600">
              <AlertTriangle className="size-3" aria-hidden />
              {plural(warnings, "warning")}
            </span>
          ) : null}
        </span>
      )}

      {isStale ? (
        <span className="flex items-center gap-1.5">
          <History className="size-3" aria-hidden />
          Showing last valid diagram
        </span>
      ) : null}

      <span className="ml-auto">
        {plural(displayIr.nodes.length, "component")} · {plural(displayIr.flows.length, "flow")}
      </span>
    </div>
  );
}
```

- [ ] **Step 5: Write the flow tabs, legend, theme toggle and I/O buttons**

`apps/web/src/components/studio/flow-tabs.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { selectDisplayIr, useStudioStore } from "@/store/studio-store";

export function FlowTabs() {
  const ir = useStudioStore(selectDisplayIr);
  const activeFlowId = useStudioStore((state) => state.activeFlowId);
  const setActiveFlow = useStudioStore((state) => state.setActiveFlow);

  if (ir.flows.length === 0) {
    return <span className="text-xs text-muted-foreground">No flows defined yet.</span>;
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      <span className="shrink-0 text-[11px] text-muted-foreground">Flow:</span>
      {ir.flows.map((flow) => (
        <Button
          key={flow.id}
          variant="outline"
          size="sm"
          onClick={() => setActiveFlow(flow.id)}
          className={cn(
            "h-7 shrink-0 rounded-full px-3.5 text-xs font-semibold",
            flow.id === activeFlowId && "border-primary bg-primary/10 text-primary",
          )}
        >
          {flow.label}
        </Button>
      ))}
    </div>
  );
}
```

`apps/web/src/components/studio/legend.tsx`:

```tsx
"use client";

import { KIND_ORDER, kindMeta } from "@/lib/kind-styles";

export function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {KIND_ORDER.map((kind) => {
        const meta = kindMeta(kind);
        return (
          <span key={kind} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="size-2.5 rounded-sm" style={{ background: meta.color }} />
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}
```

`apps/web/src/components/studio/theme-toggle.tsx`:

```tsx
"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
    </Button>
  );
}
```

`apps/web/src/components/studio/io-buttons.tsx`:

```tsx
"use client";

import { useRef } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FILE_EXTENSION, downloadText, readTextFile } from "@/lib/file-io";
import { useStudioStore } from "@/store/studio-store";

export function IoButtons() {
  const input = useRef<HTMLInputElement>(null);
  const source = useStudioStore((state) => state.source);
  const setSource = useStudioStore((state) => state.setSource);

  return (
    <div className="flex items-center gap-1">
      <input
        ref={input}
        type="file"
        accept={FILE_EXTENSION + ",.txt"}
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (file) setSource(await readTextFile(file));
          event.target.value = "";
        }}
      />
      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => input.current?.click()}>
        <Upload className="mr-1.5 size-3.5" />
        Import
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 text-xs"
        onClick={() => downloadText(`diagram${FILE_EXTENSION}`, source)}
      >
        <Download className="mr-1.5 size-3.5" />
        Export
      </Button>
    </div>
  );
}
```

- [ ] **Step 6: Write the header and the shell**

`apps/web/src/components/studio/studio-header.tsx`:

```tsx
"use client";

import { Workflow } from "lucide-react";
import { FlowTabs } from "./flow-tabs";
import { IoButtons } from "./io-buttons";
import { Legend } from "./legend";
import { ThemeToggle } from "./theme-toggle";

export function StudioHeader() {
  return (
    <header className="shrink-0 border-b bg-card">
      <div className="flex h-14 items-center justify-between gap-4 px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Workflow className="size-4" aria-hidden />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Flow Diagram</div>
            <div className="text-[11px] text-muted-foreground">
              application flows, code-first
            </div>
          </div>
        </div>
        <Legend />
        <div className="flex items-center gap-1">
          <IoButtons />
          <ThemeToggle />
        </div>
      </div>
      <div className="flex h-11 items-center gap-2 border-t px-5">
        <FlowTabs />
      </div>
    </header>
  );
}
```

`apps/web/src/components/studio/studio-shell.tsx`:

```tsx
"use client";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { CanvasPane } from "@/components/canvas/canvas-pane";
import { NodeDetailDialog } from "@/components/detail/node-detail-dialog";
import { EditorPane } from "@/components/editor/editor-pane";
import { StatusBar } from "./status-bar";
import { StudioHeader } from "./studio-header";

export function StudioShell() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <StudioHeader />
      <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize={32} minSize={20} maxSize={55}>
          <EditorPane />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={68}>
          <CanvasPane />
        </ResizablePanel>
      </ResizablePanelGroup>
      <StatusBar />
      <NodeDetailDialog />
    </div>
  );
}
```

- [ ] **Step 7: Replace the page**

`apps/web/src/app/page.tsx` — replace the Task 8 placeholder entirely:

```tsx
import { StudioShell } from "@/components/studio/studio-shell";

export default function Page() {
  return <StudioShell />;
}
```

- [ ] **Step 8: Run the tests and the app**

Run: `pnpm vitest run --project web`
Expected: PASS, 37 tests.

Run: `pnpm --filter @flow/web dev` and open http://localhost:3000

Walk through this by hand before committing:
1. The sample diagram renders with two flow pills; clicking the second changes the canvas.
2. Clicking the `Orders Database` card opens a dialog with three linked table cards.
3. Clicking `GET /v1/orders` shows the response body, JSON-highlighted.
4. Deleting a closing brace in the editor underlines the error; the canvas keeps the old diagram and the status bar says so.
5. Restoring the brace clears both.
6. Reloading the page keeps your edits (localStorage).
7. The theme toggle switches light and dark cleanly.

Stop the server.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(web): assemble studio shell with flow tabs, status bar and file I/O"
```

---

## Task 14: End-to-end smoke test and documentation

One Playwright test covering the path that matters — type DSL, see a node, click it, read the payload — plus the README. This is the task that proves the pieces work together rather than only in isolation.

**Files:**
- Create: `apps/web/playwright.config.ts`, `apps/web/e2e/studio.spec.ts`, `README.md`
- Modify: root `package.json` (add the `test:e2e` script), `.gitignore` (already covers Playwright output)

**Interfaces:**
- Consumes: the running app from Task 13.
- Produces: `pnpm test:e2e`.

- [ ] **Step 1: Install Playwright**

```bash
pnpm --filter @flow/web add -D @playwright/test
pnpm --filter @flow/web exec playwright install chromium
```

- [ ] **Step 2: Configure it**

`apps/web/playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

Add to the **root** `package.json` scripts:

```json
"test:e2e": "pnpm --filter @flow/web exec playwright test"
```

- [ ] **Step 3: Write the smoke test**

`apps/web/e2e/studio.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

// Each test starts from a clean slate: the app autosaves to localStorage, so a
// leftover diagram from a previous run would make these pass or fail at random.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");
});

test("renders the sample diagram and opens a node's details", async ({ page }) => {
  await expect(page.getByText("Order Service")).toBeVisible();

  await page.getByText("Orders Database").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("campaign")).toBeVisible();
  await expect(dialog.getByText("gross_value")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("shows the request and response of an http node", async ({ page }) => {
  await page.getByText("GET /v1/orders").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("/v1/orders")).toBeVisible();
  await expect(dialog.getByText("Response")).toBeVisible();
  await expect(dialog.getByText(/"total"/)).toBeVisible();
});

test("switching flows changes what the canvas shows", async ({ page }) => {
  await expect(page.getByText("My Orders")).toBeVisible();
  await page.getByRole("button", { name: "CRM synchronisation" }).click();
  await expect(page.getByText("Partner CRM")).toBeVisible();
  await expect(page.getByText("My Orders")).toBeHidden();
});

test("a node typed into the editor appears on the canvas", async ({ page }) => {
  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(
    'service Billing "Billing Service" {\n  desc: "Charges the customer"\n}\n' +
      'db BillingDB "Billing DB" {\n  table invoice {\n    id bigint [pk]\n  }\n}\n' +
      'flow Charge "Charge" {\n  Billing -> BillingDB : "write"\n}',
  );

  await expect(page.getByText("Billing Service")).toBeVisible();
  await expect(page.getByRole("button", { name: "Charge" })).toBeVisible();
});

test("a syntax error keeps the last valid diagram on screen", async ({ page }) => {
  await expect(page.getByText("Order Service")).toBeVisible();

  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("service Broken {");

  await expect(page.getByText(/last valid diagram/i)).toBeVisible();
  await expect(page.getByText("Order Service")).toBeVisible();
});
```

- [ ] **Step 4: Run it**

Run: `pnpm test:e2e`
Expected: 5 passed.

If the "typed into the editor" test is flaky, the cause is almost always the 150 ms compile debounce racing the assertion — Playwright's auto-waiting covers it, so do not add a fixed sleep; check that `setSource` is actually being called on every keystroke.

- [ ] **Step 5: Write the README**

`README.md`:

````markdown
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
````

- [ ] **Step 6: Full verification**

Run every check and confirm each one before claiming the task is done:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm --filter @flow/web build
```

Expected: all six exit 0. Report any failure with its output rather than
working around it.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "test: add end-to-end smoke tests and project README"
```

---

## Self-Review Notes

Checked against the spec, section by section:

- **Monorepo with `@flow/lang` framework-free** — Tasks 1, 7. Enforced by lint, not convention.
- **Lexer with spans** — Task 2. **Generic parser with error recovery** — Task 3.
- **Registry-driven node types** — Task 4. **Validator, every code** — Task 5.
- **`DiagramIR` + artifacts, `compile` never throws** — Task 6.
- **Layout, flow and ER** — Task 7.
- **Next.js, Tailwind, shadcn, theme tokens** — Task 8.
- **Store with last-valid-IR fallback** — Task 9.
- **CodeMirror with DSL highlighting and inline diagnostics** — Task 10.
- **React Flow canvas with a fallback node** — Task 11.
- **Detail dialog dispatching on artifact kind** — Task 12.
- **Header, flow tabs, legend, status bar, import/export, localStorage** — Tasks 9 and 13.
- **Screen mockups: `image:` URL plus paste, stored outside the DSL** — Tasks 9, 11, 12.
- **Tests: TDD in lang/layout, RTL for store and renderers, one Playwright smoke** — throughout, Task 14.

Two deliberate deviations from the spec, both narrowing scope:

1. The `markdown` artifact kind is dropped. No v1 node type produces one —
   descriptions live in `props.desc` and are rendered by the dialog header area.
   Keeping it would be dead code.
2. `@flow/adapters` is not created. An empty package is a speculative
   abstraction; the `DiagramIR` contract is the real seam, and the first adapter
   creates the package.
