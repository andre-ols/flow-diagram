import { KIND_ORDER, kindMeta } from "@/lib/kind-styles";

export default function Page() {
  return (
    <main className="flex h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-lg font-semibold">Flow Diagram</h1>
      <div className="flex gap-4">
        {KIND_ORDER.map((kind) => {
          const meta = kindMeta(kind);
          return (
            <div key={kind} className="flex items-center gap-2 text-xs">
              <span className="size-3 rounded-sm" style={{ background: meta.color }} />
              <meta.Icon className="size-3.5" />
              {meta.label}
            </div>
          );
        })}
      </div>
    </main>
  );
}
