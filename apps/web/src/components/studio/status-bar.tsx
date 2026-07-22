"use client";

import { AlertTriangle, CircleAlert, CircleCheck, History } from "lucide-react";
import { selectDisplayIr, selectIsStale, useStudioStore } from "@/store/studio-store";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export function StatusBar() {
  const diagnostics = useStudioStore((state) => state.ir.diagnostics);
  const displayIr = useStudioStore(selectDisplayIr);
  const isStale = useStudioStore(selectIsStale);

  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const warnings = diagnostics.length - errors;

  return (
    <div className="flex h-7 shrink-0 items-center gap-4 border-t bg-card px-4 text-[11px] text-muted-foreground">
      {errors === 0 && warnings === 0 ? (
        <span className="flex items-center gap-1.5">
          <CircleCheck className="size-3 text-emerald-500" aria-hidden />
          No problems
        </span>
      ) : (
        <span className="flex items-center gap-3">
          {errors > 0 ? (
            <span className="flex items-center gap-1.5 text-destructive">
              <CircleAlert className="size-3" aria-hidden />
              {plural(errors, "error")}
            </span>
          ) : null}
          {warnings > 0 ? (
            <span className="flex items-center gap-1.5 text-amber-600">
              <AlertTriangle className="size-3" aria-hidden />
              {plural(warnings, "warning")}
            </span>
          ) : null}
        </span>
      )}

      {isStale ? (
        <span className="flex items-center gap-1.5">
          <History className="size-3" aria-hidden />
          Showing last valid diagram
        </span>
      ) : null}

      <span className="ml-auto">
        {plural(displayIr.nodes.length, "component")} · {plural(displayIr.flows.length, "flow")}
      </span>
    </div>
  );
}
