import type { LinkRef } from "@/types/tree";

const URL_RE =
  /\b(?:https?:\/\/[^\s<>"')\]]+|(?:[a-z0-9-]+\.)+(?:gov|org|com|net|edu|us|io|app|dev|info)\b(?:\/[^\s<>"')\]]*)?)/gi;

export function extractLinks(text: string): LinkRef[] {
  const out: LinkRef[] = [];
  if (!text) return out;
  for (const m of text.matchAll(URL_RE)) {
    let raw = m[0];
    raw = raw.replace(/[.,;:!?]+$/, "");
    if (raw.length < 4) continue;
    out.push({ url: raw, start: m.index ?? 0, end: (m.index ?? 0) + raw.length });
  }
  return out;
}

export function toHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function shortLabel(url: string): string {
  try {
    const u = new URL(toHref(url));
    const path = u.pathname === "/" ? "" : u.pathname;
    const s = u.hostname.replace(/^www\./, "") + path;
    return s.length > 42 ? s.slice(0, 40) + "…" : s;
  } catch {
    return url.length > 42 ? url.slice(0, 40) + "…" : url;
  }
}
