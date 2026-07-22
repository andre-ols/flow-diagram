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
