"use client";

import { useRef } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FILE_EXTENSION, downloadText, readTextFile } from "@/lib/file-io";
import { useStudioStore } from "@/store/studio-store";

export function IoButtons() {
  const input = useRef<HTMLInputElement>(null);
  const source = useStudioStore((state) => state.source);
  const setSource = useStudioStore((state) => state.setSource);

  return (
    <div className="flex items-center gap-1">
      <input
        ref={input}
        type="file"
        accept={FILE_EXTENSION + ",.txt"}
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (file) setSource(await readTextFile(file));
          event.target.value = "";
        }}
      />
      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => input.current?.click()}>
        <Upload className="mr-1.5 size-3.5" />
        Import
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 text-xs"
        onClick={() => downloadText(`diagram${FILE_EXTENSION}`, source)}
      >
        <Download className="mr-1.5 size-3.5" />
        Export
      </Button>
    </div>
  );
}
