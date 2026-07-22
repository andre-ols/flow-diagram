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
