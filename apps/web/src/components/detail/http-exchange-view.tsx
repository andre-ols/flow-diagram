"use client";

import type { HttpExchangeArtifact } from "@flow/lang";
import { methodColor, statusColor } from "@/lib/http-colors";
import { JsonCode } from "./json-code";

export function HttpExchangeView({ artifact }: { artifact: HttpExchangeArtifact }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span
          className="rounded-md px-2.5 py-1 text-xs font-bold text-white"
          style={{ background: methodColor(artifact.method) }}
        >
          {artifact.method || "?"}
        </span>
        <span className="font-mono text-[13.5px]">{artifact.path}</span>
      </div>

      {artifact.request?.payload ? (
        <section className="space-y-2">
          <h3 className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
            Request body
          </h3>
          <JsonCode json={artifact.request.payload} />
        </section>
      ) : null}

      {artifact.response ? (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
              Response
            </h3>
            <span
              className="text-[10.5px] font-bold"
              style={{ color: statusColor(artifact.response.status) }}
            >
              {artifact.response.status}
            </span>
          </div>
          {artifact.response.payload ? <JsonCode json={artifact.response.payload} /> : null}
        </section>
      ) : null}
    </div>
  );
}
