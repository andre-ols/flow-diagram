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
        if (def.entryMode === "fields" && !entry.block.id) {
          diagnostics.push(
            error(
              "missing-id",
              `A "${entry.block.keyword}" needs a name.`,
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
