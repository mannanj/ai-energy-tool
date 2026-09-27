export const WORKER_ORIGIN = process.env.NEXT_PUBLIC_WORKER_ORIGIN || "";
export const TREE_ID = "main";

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

/** Where the WebSocket provider connects: host only, no protocol. */
export function partyHost(): string {
  const origin = WORKER_ORIGIN || (typeof window !== "undefined" ? window.location.origin : "");
  return origin.replace(/^https?:\/\//, "");
}

export function fullName(u: { firstName: string; lastName: string }) {
  return `${u.firstName} ${u.lastName}`.trim();
}
