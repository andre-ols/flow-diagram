"use client";

import { useEffect } from "react";
import { decodeShareHash } from "@/lib/share-url";
import { useStudioStore } from "@/store/studio-store";

export function SharedFlowLoader() {
  const setSource = useStudioStore((state) => state.setSource);

  useEffect(() => {
    let cancelled = false;

    const loadFromHash = () => {
      const hash = window.location.hash;

      void decodeShareHash(hash)
        .then((source) => {
          if (!cancelled && hash === window.location.hash && source !== null) setSource(source);
        })
        .catch(() => {
          // A malformed share hash must not replace the locally saved diagram.
        });
    };

    loadFromHash();
    window.addEventListener("hashchange", loadFromHash);

    return () => {
      cancelled = true;
      window.removeEventListener("hashchange", loadFromHash);
    };
  }, [setSource]);

  return null;
}
