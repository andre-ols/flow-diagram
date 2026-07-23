"use client";

import { Handle, Position } from "@xyflow/react";
import type { CSSProperties, ReactNode } from "react";
import { kindMeta } from "@/lib/kind-styles";
import { cn } from "@/lib/utils";

export function NodeShell({
  kind,
  selected,
  children,
}: {
  kind: string;
  selected?: boolean;
  children: ReactNode;
}) {
  const meta = kindMeta(kind);
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card ring-1 ring-black/[0.04] transition-all duration-150 dark:ring-white/[0.06]",
        "shadow-[0_1px_2px_0_color-mix(in_oklch,var(--foreground)_10%,transparent)]",
        selected
          ? "ring-2 ring-offset-2 ring-offset-background"
          : "hover:shadow-[0_6px_16px_-4px_color-mix(in_oklch,var(--foreground)_22%,transparent)]",
      )}
      style={selected ? ({ "--tw-ring-color": meta.color } as CSSProperties) : undefined}
    >
      <div className="h-1.5 shrink-0" style={{ background: meta.color }} />
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5 px-3 py-2">
        <div
          className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.08em]"
          style={{ color: meta.color }}
        >
          <meta.Icon className="size-3" aria-hidden />
          {meta.label}
        </div>
        {children}
      </div>
      <Handle type="target" position={Position.Left} className="!size-2 !border-0 !bg-muted-foreground" />
      <Handle type="source" position={Position.Right} className="!size-2 !border-0 !bg-muted-foreground" />
    </div>
  );
}

export function NodeTitle({ children }: { children: ReactNode }) {
  return <div className="truncate text-[13px] font-semibold leading-tight">{children}</div>;
}

export function NodeSubtitle({ children }: { children: ReactNode }) {
  return <div className="truncate text-[11px] text-muted-foreground">{children}</div>;
}
