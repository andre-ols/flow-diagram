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
