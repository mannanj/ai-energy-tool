import { api, TREE_ID } from "./api";
import type { TreeDocument } from "@/types/tree";

export interface VersionInfo { n: number; createdAt: string; label: string; author: string; nodeCount: number; edgeCount: number }

const base = `/api/tree/${TREE_ID}/versions`;

export const listVersions = async () => (await api<{ versions: VersionInfo[] }>(base)).data.versions ?? [];
export const getVersion = async (n: number) => (await api<TreeDocument>(`${base}/${n}`)).data;
export const saveCheckpoint = async (label: string) => api<{ ok: boolean; n: number | null }>(base, { method: "POST", body: JSON.stringify({ label }) });
export const restoreVersion = async (n: number) => api<{ ok: boolean }>(`${base}/${n}/restore`, { method: "POST" });

export function formatWhen(iso: string) {
  const d = new Date(iso), now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
