"use client";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { CanvasPane } from "@/components/canvas/canvas-pane";
import { NodeDetailDialog } from "@/components/detail/node-detail-dialog";
import { EditorPane } from "@/components/editor/editor-pane";
import { StatusBar } from "./status-bar";
import { StudioHeader } from "./studio-header";

export function StudioShell() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <StudioHeader />
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize="32" minSize="20" maxSize="55">
          <EditorPane />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="68">
          <CanvasPane />
        </ResizablePanel>
      </ResizablePanelGroup>
      <StatusBar />
      <NodeDetailDialog />
    </div>
  );
}
