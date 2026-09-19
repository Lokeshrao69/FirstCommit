export function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function fmtConfidence(confidence: number | null | undefined): string {
  if (confidence === null || confidence === undefined) return "—";
  return `${(confidence * 100).toFixed(0)}%`;
}

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function shortId(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export function confidenceTone(confidence: number): "ok" | "warn" | "err" {
  if (confidence >= 0.85) return "ok";
  if (confidence >= 0.6) return "warn";
  return "err";
}