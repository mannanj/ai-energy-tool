export const WORKER_ORIGIN = process.env.NEXT_PUBLIC_WORKER_ORIGIN || "";
export const DEFAULT_TREE_ID = "main";

export function currentTreeId(): string {
  if (typeof window === "undefined") return DEFAULT_TREE_ID;
  const t = new URLSearchParams(window.location.search).get("tree");
  return t && /^[\w-]{2,40}$/.test(t) ? t : DEFAULT_TREE_ID;
}

export function treeHref(id: string, path = "/"): string {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  if (id === DEFAULT_TREE_ID) params.delete("tree"); else params.set("tree", id);
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}

export interface Me { id: string; firstName: string; lastName: string; email: string; color: string }

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<{ status: number; data: T }> {
  const res = await fetch(`${WORKER_ORIGIN}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    ...init,
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, data };
}

export function partyHost(): string {
  const origin = WORKER_ORIGIN || (typeof window !== "undefined" ? window.location.origin : "");
  return origin.replace(/^https?:\/\//, "");
}

export function fullName(u: { firstName: string; lastName: string }) {
  return `${u.firstName} ${u.lastName}`.trim();
}
