import { defaultRegistry } from "@flow/lang";
import { Boxes, Database, Globe, MonitorSmartphone, Radio, Server } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface KindMeta {
  key: string;
  /** Uppercase badge text. Comes from the language registry. */
  label: string;
  /** A CSS var() reference, so light and dark themes swap automatically. */
  color: string;
  Icon: LucideIcon;
}

/**
 * Legend order, and the order kinds appear in any kind-grouped list. Derived
 * from the language registry so adding a node type there is enough — there is
 * no second list to keep in sync. `kind-styles.test.ts` asserts they match.
 */
export const KIND_ORDER = [...defaultRegistry.keys()];

/**
 * Icons are the one thing the registry cannot supply (it stays free of any
 * React/lucide dependency), so they are mapped here. Every registry kind must
 * have an entry; `kind-styles.test.ts` fails if this drifts from the registry.
 */
const ICONS: Record<string, LucideIcon> = {
  screen: MonitorSmartphone,
  service: Server,
  http: Globe,
  db: Database,
  topic: Radio,
};

const FALLBACK: KindMeta = {
  key: "default",
  label: "COMPONENT",
  color: "var(--kind-default)",
  Icon: Boxes,
};

/**
 * Never throws for an unknown kind. A node type the UI has not been taught
 * about must still render — that is what keeps the canvas open to extension.
 */
export function kindMeta(kind: string): KindMeta {
  const def = defaultRegistry.get(kind);
  const Icon = ICONS[kind];
  if (!def || !Icon) return FALLBACK;
  // The CSS var name is owned by the registry (`colorToken`), not rebuilt from
  // the kind string here — one source of truth for a kind's colour.
  return { key: kind, label: def.label, color: `var(${def.colorToken})`, Icon };
}
