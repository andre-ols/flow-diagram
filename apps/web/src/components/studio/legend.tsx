"use client";

import { KIND_ORDER, kindMeta } from "@/lib/kind-styles";

export function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {KIND_ORDER.map((kind) => {
        const meta = kindMeta(kind);
        return (
          <span key={kind} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="size-2.5 rounded-sm" style={{ background: meta.color }} />
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}
