"use client";
import { useState } from "react";
import { useTreeStore } from "@/lib/store";
import { api, fullName } from "@/lib/api";

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

export function Presence() {
  const [menu, setMenu] = useState(false);
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
      <span className="relative">
        <button type="button" onClick={() => setMenu(!menu)} title={`${fullName(me)} (you)`} style={{ background: me.color }} className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-white dark:ring-neutral-900">
          {initials(fullName(me))}
        </button>
        {menu && (
          <div onMouseLeave={() => setMenu(false)} className="absolute right-0 top-9 z-20 min-w-[160px] rounded-lg border border-neutral-200 bg-white py-1 text-[12px] shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
            <div className="px-3 py-1.5 text-neutral-500">{fullName(me)}</div>
            <button type="button" onClick={signOut} className="block w-full px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800">Sign out</button>
          </div>
        )}
      </span>
    </div>
  );
}
