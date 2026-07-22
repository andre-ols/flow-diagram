"use client";

import type { ImageArtifact } from "@flow/lang";

export function ImageView({ artifact }: { artifact: ImageArtifact }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      {/* Arbitrary remote URLs and data URLs: next/image cannot help here. */}
      <img src={artifact.src} alt={artifact.alt ?? "Screen mockup"} className="w-full object-contain" />
    </div>
  );
}
