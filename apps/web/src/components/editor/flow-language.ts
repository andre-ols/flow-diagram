import { StreamLanguage, type StreamParser } from "@codemirror/language";
import { defaultRegistry, FLOW_KEYWORD } from "@flow/lang";

// Highlight exactly the node keywords the language defines, plus the structural
// `flow` keyword. Derived from the registry so a new node type lights up here
// without editing this file.
const NODE_KEYWORDS = new Set([...defaultRegistry.keys(), FLOW_KEYWORD]);
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
