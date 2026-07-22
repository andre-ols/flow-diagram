"use client";

import { Workflow } from "lucide-react";
import { FlowTabs } from "./flow-tabs";
import { IoButtons } from "./io-buttons";
import { Legend } from "./legend";
import { ThemeToggle } from "./theme-toggle";

export function StudioHeader() {
  return (
    <header className="shrink-0 border-b bg-card">
      <div className="flex h-14 items-center justify-between gap-4 px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Workflow className="size-4" aria-hidden />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Flow Diagram</div>
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
