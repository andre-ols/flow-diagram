"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { selectDisplayIr, useStudioStore } from "@/store/studio-store";

export function FlowTabs() {
  const ir = useStudioStore(selectDisplayIr);
  const activeFlowId = useStudioStore((state) => state.activeFlowId);
  const setActiveFlow = useStudioStore((state) => state.setActiveFlow);

  if (ir.flows.length === 0) {
    return <span className="text-xs text-muted-foreground">No flows defined yet.</span>;
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      <span className="shrink-0 text-[11px] text-muted-foreground">Flow:</span>
      {ir.flows.map((flow) => (
        <Button
          key={flow.id}
          variant="outline"
          size="sm"
          onClick={() => setActiveFlow(flow.id)}
          className={cn(
            "h-7 shrink-0 rounded-full px-3.5 text-xs font-semibold",
            flow.id === activeFlowId && "border-primary bg-primary/10 text-primary",
          )}
        >
          {flow.label}
        </Button>
      ))}
    </div>
  );
}
