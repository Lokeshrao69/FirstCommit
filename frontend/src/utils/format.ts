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

/** Compact relative time such as "2 min ago" (never in the future). */
export function fmtRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Math.max(0, Date.now() - d.getTime());
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return minutes === 1 ? "1 min ago" : `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

/** Full local date + time for a `title` attribute. */
export function fmtFullTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
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