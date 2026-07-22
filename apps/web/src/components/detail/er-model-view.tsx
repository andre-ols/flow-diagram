"use client";

import { useMemo } from "react";
import type { ErModelArtifact } from "@flow/lang";
import {
  ER_HEADER_HEIGHT,
  ER_ROW_HEIGHT,
  ER_TABLE_WIDTH,
  erTableHeight,
  layoutErModel,
} from "@flow/layout";
import { bezierPath } from "@/lib/svg-path";

/** Vertical centre of a column row, relative to the table's top edge. */
function rowCentre(index: number): number {
  return ER_HEADER_HEIGHT + index * ER_ROW_HEIGHT + ER_ROW_HEIGHT / 2;
}

export function ErModelView({ artifact }: { artifact: ErModelArtifact }) {
  const layout = useMemo(() => layoutErModel(artifact), [artifact]);

  if (artifact.tables.length === 0) {
    return <p className="text-sm text-muted-foreground">This database declares no tables yet.</p>;
  }

  const columnIndex = (table: string, column: string) => {
    const found = artifact.tables.find((candidate) => candidate.name === table);
    const index = found?.fields.findIndex((field) => field.name === column) ?? -1;
    return index < 0 ? 0 : index;
  };

  return (
    <div className="overflow-auto">
      <div className="relative" style={{ width: layout.width, height: layout.height }}>
        <svg
          width={layout.width}
          height={layout.height}
          className="pointer-events-none absolute left-0 top-0 overflow-visible"
        >
          {artifact.refs.map((ref, index) => {
            const from = layout.positions[ref.fromTable];
            const to = layout.positions[ref.toTable];
            if (!from || !to) return null;
            const forward = to.x >= from.x;
            const x1 = forward ? from.x + ER_TABLE_WIDTH : from.x;
            const x2 = forward ? to.x : to.x + ER_TABLE_WIDTH;
            const y1 = from.y + rowCentre(columnIndex(ref.fromTable, ref.fromField));
            const y2 = to.y + rowCentre(columnIndex(ref.toTable, ref.toField));
            return (
              <g key={`${ref.fromTable}.${ref.fromField}-${index}`}>
                <path
                  d={bezierPath(x1, y1, x2, y2)}
                  fill="none"
                  stroke="var(--kind-db)"
                  strokeWidth={1.6}
                  opacity={0.75}
                />
                <text x={x1} y={y1 - 6} fontSize={10} fontWeight={600} fill="var(--kind-db)">
                  {ref.op.includes(">") ? "*" : "1"}
                </text>
                <text
                  x={x2}
                  y={y2 - 6}
                  fontSize={10}
                  fontWeight={600}
                  fill="var(--kind-db)"
                  textAnchor="end"
                >
                  {ref.op.includes("<") ? "*" : "1"}
                </text>
              </g>
            );
          })}
        </svg>

        {artifact.tables.map((table) => {
          const position = layout.positions[table.name];
          if (!position) return null;
          return (
            <div
              key={table.name}
              className="absolute overflow-hidden rounded-lg border bg-card shadow-sm"
              style={{
                left: position.x,
                top: position.y,
                width: ER_TABLE_WIDTH,
                height: erTableHeight(table.fields.length),
              }}
            >
              <div
                className="flex items-center px-3 text-[12.5px] font-semibold text-white"
                style={{ background: "var(--kind-db)", height: ER_HEADER_HEIGHT }}
              >
                {table.name}
              </div>
              {table.fields.map((field) => (
                <div
                  key={field.name}
                  className="flex items-center justify-between gap-2 border-b px-3 last:border-b-0"
                  style={{ height: ER_ROW_HEIGHT }}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    {field.pk ? (
                      <span className="rounded bg-primary/10 px-1 text-[8px] font-bold text-primary">PK</span>
                    ) : null}
                    {field.fk ? (
                      <span className="rounded bg-amber-500/15 px-1 text-[8px] font-bold text-amber-600">FK</span>
                    ) : null}
                    <span className="truncate font-mono text-[11.5px]">{field.name}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {field.type}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
