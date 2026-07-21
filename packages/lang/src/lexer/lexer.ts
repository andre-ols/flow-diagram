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
