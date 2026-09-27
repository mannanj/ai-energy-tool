"use client";
import { useTreeStore } from "@/lib/store";
import { api, fullName } from "@/lib/api";

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/** Who is here right now, plus sign out. */
export function Presence() {
  const me = useTreeStore((s) => s.me);
  const peers = useTreeStore((s) => s.peers);
  const connected = useTreeStore((s) => s.connected);
  if (!me) return null;
  const seen = new Set<string>();
  const others = peers.filter((p) => (seen.has(p.user.id) ? false : (seen.add(p.user.id), true)));
  const signOut = async () => { await api("/api/signout", { method: "POST" }); window.location.href = "/signin"; };
  return (
    <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white/95 p-1 shadow-md dark:border-neutral-700 dark:bg-neutral-900/95">
      <span title={connected ? "Connected" : "Reconnecting…"} className={`mx-1 h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-400"}`} />
      {others.map((p) => (
        <span key={p.user.id} title={p.user.name} style={{ background: p.user.color }} className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white">
          {initials(p.user.name)}
        </span>
      ))}
      <span title={`${fullName(me)} (you)`} style={{ background: me.color }} className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-white dark:ring-neutral-900">
        {initials(fullName(me))}
      </span>
      <button onClick={signOut} title="Sign out" className="ml-1 rounded px-2 py-1 text-[11px] text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800">sign out</button>
    </div>
  );
}
