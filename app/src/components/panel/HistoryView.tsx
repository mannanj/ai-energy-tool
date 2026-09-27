"use client";
import { useCallback, useEffect, useState } from "react";
import { formatWhen, listVersions, restoreVersion, saveCheckpoint, type VersionInfo } from "@/lib/versions";
import { useTreeStore } from "@/lib/store";

export function HistoryView() {
  const [versions, setVersions] = useState<VersionInfo[] | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState<number | "save" | null>(null);
  const [msg, setMsg] = useState("");
  const updatedAt = useTreeStore((s) => s.doc.tree.updatedAt);

  const refresh = useCallback(async () => setVersions(await listVersions()), []);
  useEffect(() => { refresh(); }, [refresh, updatedAt]);

  const checkpoint = async () => {
    setBusy("save");
    const { data } = await saveCheckpoint(label);
    setMsg(data.n ? `Saved checkpoint #${data.n}` : "Nothing changed since the last version");
    setLabel(""); setBusy(null); refresh();
  };
  const restore = async (v: VersionInfo) => {
    if (!confirm(`Restore the tree to version #${v.n} from ${formatWhen(v.createdAt)} (${v.nodeCount} squares)?\n\nA "before restore" checkpoint is saved first, so this can be undone.`)) return;
    setBusy(v.n);
    await restoreVersion(v.n);
    setMsg(`Restored #${v.n}`); setBusy(null); refresh();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-200 p-3 dark:border-neutral-700">
        <div className="flex gap-2">
          <input value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && checkpoint()}
            placeholder="Checkpoint name (optional)"
            className="min-w-0 flex-1 rounded border border-neutral-200 px-2 py-1 text-[13px] outline-none focus:border-sky-400 dark:border-neutral-700 dark:bg-neutral-900" />
          <button onClick={checkpoint} disabled={busy !== null} className="rounded bg-sky-600 px-3 py-1 text-[12px] text-white hover:bg-sky-700 disabled:opacity-40">Save checkpoint</button>
        </div>
        <p className="mt-2 text-[11px] text-neutral-500">Snapshots are taken automatically while people edit, at most once a minute. Restoring never deletes history.</p>
        {msg && <p className="mt-1 text-[11px] text-emerald-700">{msg}</p>}
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-6">
        {versions === null ? (
          <p className="py-3 text-[12px] text-neutral-500">Loading…</p>
        ) : versions.length === 0 ? (
          <p className="py-3 text-[12px] text-neutral-500">No versions yet. They appear once the tree changes.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {versions.map((v, i) => (
              <li key={v.n} className="flex items-center gap-2 py-2 text-[12px]">
                <span className="w-9 shrink-0 font-mono text-neutral-400">#{v.n}</span>
                <span className="w-24 shrink-0">{formatWhen(v.createdAt)}</span>
                <span className={`min-w-0 flex-1 truncate ${v.label === "auto" ? "text-neutral-500" : "font-medium"}`} title={`${v.label} · ${v.author}`}>
                  {v.label === "auto" ? "auto save" : v.label}{v.author !== "auto" ? ` · ${v.author}` : ""}
                </span>
                <span className="shrink-0 text-neutral-500">{v.nodeCount} sq · {v.edgeCount} ar</span>
                <button onClick={() => restore(v)} disabled={busy !== null || i === 0} title={i === 0 ? "This is the latest version" : "Restore this version"}
                  className="shrink-0 rounded px-2 py-0.5 text-sky-700 hover:bg-sky-50 disabled:opacity-30 dark:hover:bg-sky-950">
                  {busy === v.n ? "…" : "restore"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
