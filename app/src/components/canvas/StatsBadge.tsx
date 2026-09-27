"use client";
import { useMemo, useState } from "react";
import { Panel } from "@xyflow/react";
import { useTreeStore } from "@/lib/store";
import { deriveTree, orderedNodes, toMarkdown } from "@/lib/derive";

export function StatsBadge() {
  const doc = useTreeStore((s) => s.doc);
  const panelOpen = useTreeStore((s) => s.panelOpen);
  const view = useTreeStore((s) => s.panelView);
  const { setPanelOpen, setPanelView } = useTreeStore.getState();
  const [copied, setCopied] = useState(false);
  const list = useMemo(() => orderedNodes(deriveTree(doc), doc.tree.rootNodeId), [doc]);

  const open = (v: "tree" | "history") => {
    if (panelOpen && view === v) { setPanelOpen(false); return; }
    setPanelView(v); setPanelOpen(true);
  };
  const copyAll = async () => {
    try { await navigator.clipboard.writeText(toMarkdown(list)); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch {}
  };
  const active = (v: "tree" | "history") => panelOpen && view === v;
  const btn = (on: boolean) => `rounded px-2 py-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 ${on ? "bg-neutral-100 dark:bg-neutral-800" : ""}`;

  return (
    <Panel position="top-center" className="!m-3">
      <div className="flex items-center gap-1 rounded-md border border-neutral-200 bg-white/95 px-3 py-1.5 text-[12px] text-neutral-600 shadow dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-neutral-300">
        <span className="mr-2 max-w-[260px] truncate font-medium text-neutral-800 dark:text-neutral-100" title={doc.tree.name}>{doc.tree.name}</span>
        <button type="button" title="List the squares and add new ones" onClick={() => open("tree")} className={btn(active("tree"))}>squares</button>
        <button type="button" title="Version history: snapshots, checkpoints, restore" onClick={() => open("history")} className={btn(active("history"))}>history</button>
        <button type="button" title="Copy the whole tree as text" onClick={copyAll} className={btn(false)}>{copied ? "✓ copied" : "copy tree"}</button>
      </div>
    </Panel>
  );
}
