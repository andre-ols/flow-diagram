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
