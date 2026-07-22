"use client";

import type { JsonPayloadArtifact } from "@flow/lang";
import { JsonCode } from "./json-code";

export function JsonPayloadView({ artifact }: { artifact: JsonPayloadArtifact }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
        {artifact.title}
      </h3>
      <JsonCode json={artifact.json} />
    </section>
  );
}
