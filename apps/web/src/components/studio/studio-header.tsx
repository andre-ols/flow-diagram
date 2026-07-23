"use client";

import { Workflow } from "lucide-react";
import { FlowTabs } from "./flow-tabs";
import { IoButtons } from "./io-buttons";
import { Legend } from "./legend";
import { ThemeToggle } from "./theme-toggle";

export function StudioHeader() {
  return (
    <header className="shrink-0 border-b bg-card/95 shadow-[0_1px_0_0_color-mix(in_oklch,var(--foreground)_6%,transparent)] backdrop-blur-sm">
      <div className="flex h-14 items-center justify-between gap-4 px-5">
        <div className="flex items-center gap-2.5">
          <span
            className="flex size-8 items-center justify-center rounded-lg text-white shadow-sm ring-1 ring-white/15"
            style={{
              background:
                "linear-gradient(135deg, var(--kind-screen), var(--kind-http) 55%, var(--kind-topic))",
            }}
          >
            <Workflow className="size-4" aria-hidden />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">Flow Diagram</div>
            <div className="text-[11px] text-muted-foreground">
              application flows, code-first
            </div>
          </div>
        </div>
        <Legend />
        <div className="flex items-center gap-1">
          <IoButtons />
          <ThemeToggle />
        </div>
      </div>
      <div className="flex h-11 items-center gap-2 border-t px-5">
        <FlowTabs />
      </div>
    </header>
  );
}
