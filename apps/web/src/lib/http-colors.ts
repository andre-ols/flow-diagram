const METHOD_COLORS: Record<string, string> = {
  GET: "oklch(0.55 0.11 150)",
  POST: "oklch(0.5 0.13 262)",
  PUT: "oklch(0.6 0.13 70)",
  PATCH: "oklch(0.55 0.1 300)",
  DELETE: "oklch(0.55 0.15 24)",
};

export function methodColor(method: string): string {
  return METHOD_COLORS[method.toUpperCase()] ?? "var(--kind-http)";
}

/** 2xx reads as success, 4xx/5xx as failure, anything else as neutral. */
export function statusColor(status: string): string {
  if (/^2/.test(status)) return "oklch(0.5 0.12 150)";
  if (/^[45]/.test(status)) return "oklch(0.55 0.15 24)";
  return "var(--kind-default)";
}
