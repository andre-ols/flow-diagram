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

  /**
   * Skip remaining tokens on `line`, stopping at a brace or eof. The anchor must be
   * the malformed header's own line (not derived from `peek()`): once the cursor has
   * already consumed everything on that line, `peek()` lands on the *next*
   * statement's line, and skipping "the rest of that line" would wrongly eat it.
   */
  private skipToLineEnd(line: number): void {
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
      this.skipToLineEnd(keywordToken.span.line);
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
