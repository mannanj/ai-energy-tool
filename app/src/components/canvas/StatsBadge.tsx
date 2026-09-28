"use client";
import { useEffect, useRef, useState } from "react";
import { Panel } from "@xyflow/react";
import { useTreeStore } from "@/lib/store";
import { treeHref } from "@/lib/api";

export function StatsBadge() {
  const name = useTreeStore((s) => s.doc.tree.name);
  const treeId = useTreeStore((s) => s.treeId);
  const trees = useTreeStore((s) => s.trees);
  const loadTrees = useTreeStore((s) => s.loadTrees);
  const createTree = useTreeStore((s) => s.createTree);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    loadTrees();
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open, loadTrees]);

  const newTree = async () => {
    const n = prompt("Name for the new tree");
    if (!n?.trim()) return;
    setBusy(true);
    await createTree(n.trim());
    setBusy(false);
  };

  return (
    <Panel position="top-center" className="!m-3">
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          title="Switch tree or start a new one"
          className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white/95 px-3 py-1.5 text-[12px] text-neutral-600 shadow hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <span>Tree:</span>
          <span className="max-w-[320px] truncate font-medium text-neutral-800 dark:text-neutral-100">{name || treeId}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        {open && (
          <div className="absolute left-1/2 top-9 z-30 min-w-[300px] -translate-x-1/2 rounded-lg border border-neutral-200 bg-white py-1 text-[12px] shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
            <button type="button" disabled={busy} onClick={newTree} className="flex w-full items-center gap-2 px-3 py-2 text-left font-medium text-sky-700 hover:bg-neutral-100 disabled:opacity-40 dark:text-sky-400 dark:hover:bg-neutral-800">
              <span className="text-[15px] leading-none">+</span> New tree
            </button>
            <div className="my-1 h-px bg-neutral-200 dark:bg-neutral-700" />
            {trees.length === 0 && <div className="px-3 py-2 text-neutral-500">Loading…</div>}
            {trees.map((t) => (
              <a key={t.id} href={treeHref(t.id)} className={`flex items-center gap-2 px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 ${t.id === treeId ? "bg-neutral-100 font-medium dark:bg-neutral-800" : ""}`}>
                <span className="min-w-0 flex-1 truncate">{t.name}</span>
                {t.pdfKey && <span className="rounded border border-amber-500 px-1 text-[10px] text-amber-600">PDF</span>}
                {t.id === treeId && <span className="text-neutral-400">current</span>}
              </a>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
