"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildShareUrl } from "@/lib/share-url";
import { useStudioStore } from "@/store/studio-store";

type ShareStatus = "idle" | "copied" | "error";

export function ShareButton() {
  const source = useStudioStore((state) => state.source);
  const [status, setStatus] = useState<ShareStatus>("idle");
  const resetTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    },
    [],
  );

  const share = async () => {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);

    try {
      const url = await buildShareUrl(source, window.location.href);
      await navigator.clipboard.writeText(url);
      setStatus("copied");
      resetTimer.current = window.setTimeout(() => setStatus("idle"), 2_000);
    } catch {
      setStatus("error");
    }
  };

  const label = status === "copied" ? "Copied" : status === "error" ? "Try again" : "Share";

  return (
    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={share}>
      {status === "copied" ? (
        <Check className="mr-1.5 size-3.5" aria-hidden />
      ) : (
        <Share2 className="mr-1.5 size-3.5" aria-hidden />
      )}
      {label}
    </Button>
  );
}
