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
