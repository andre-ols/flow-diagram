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
