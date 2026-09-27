"use client";
import { useState } from "react";
import type { DerivedNode } from "@/types/tree";
import { useLock, useTreeStore } from "@/lib/store";
import { LockNotice } from "@/components/LockNotice";
import { LinkPills } from "@/components/LinkPills";
import { ROOT_PLACEHOLDER } from "@/lib/seed";

const roleColor: Record<string, string> = {
  question: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  answer: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  source: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
};

export function NodeRow({ d, dim }: { d: DerivedNode; dim?: boolean }) {
  const updateText = useTreeStore((s) => s.updateNodeText);
  const addChild = useTreeStore((s) => s.addChild);
  const deleteNode = useTreeStore((s) => s.deleteNode);
  const select = useTreeStore((s) => s.select);
  const selected = useTreeStore((s) => s.selectedNodeId === d.node.id);
  const acquireLock = useTreeStore((s) => s.acquireLock);
  const releaseLock = useTreeStore((s) => s.releaseLock);
  const { lockedBy } = useLock(d.node.id);
  const [copied, setCopied] = useState(false);
  const n = d.node;

  const copy = async () => {
    try { await navigator.clipboard.writeText(n.text); setCopied(true); setTimeout(() => setCopied(false), 1000); } catch {}
  };

  return (
    <div
      style={{ marginLeft: Math.min(d.depth, 8) * 14 }}
      className={`rounded-md border p-2 text-[13px] ${selected ? "border-sky-400 bg-sky-50/50 dark:bg-sky-950/30" : "border-neutral-200 dark:border-neutral-700"} ${dim ? "opacity-40" : ""}`}
      onClick={() => select(n.id)}
    >
      <div className="mb-1 flex items-center gap-2 text-[11px] text-neutral-500">
        <span className="font-mono">{n.isRoot ? "root" : d.number}</span>
        <span className={`rounded px-1.5 py-0.5 ${roleColor[d.role]}`}>{d.role}</span>
        {d.links.length > 0 && <span>{d.links.length} link{d.links.length > 1 ? "s" : ""}</span>}
        <span className="ml-auto flex gap-1">
          <button title="Copy text" onClick={(e) => { e.stopPropagation(); copy(); }} className="rounded px-1 hover:bg-neutral-100 dark:hover:bg-neutral-800">{copied ? "✓" : "copy"}</button>
          <button title="Add connected child" onClick={(e) => { e.stopPropagation(); addChild(n.id); }} className="rounded px-1 hover:bg-neutral-100 dark:hover:bg-neutral-800">+ child</button>
          {!n.isRoot && (
            <button title="Delete square" disabled={!!lockedBy} onClick={(e) => { e.stopPropagation(); if (confirm("Delete this square and its arrows?")) deleteNode(n.id); }} className="rounded px-1 text-red-600 hover:bg-neutral-100 dark:hover:bg-neutral-800">del</button>
          )}
        </span>
      </div>
      {lockedBy && <LockNotice lock={lockedBy} className="mb-1" />}
      <textarea
        value={n.text}
        disabled={!!lockedBy}
        onFocus={(e) => { if (!acquireLock(n.id)) e.currentTarget.blur(); }}
        onBlur={() => releaseLock(n.id)}
        onChange={(e) => updateText(n.id, e.target.value)}
        placeholder={n.isRoot ? ROOT_PLACEHOLDER : "Type text. Paste links, they become pills below."}
        rows={Math.min(8, Math.max(2, Math.ceil(n.text.length / 60)))}
        className={`w-full resize-y rounded border bg-white px-2 py-1 text-[13px] leading-snug outline-none focus:border-sky-400 disabled:bg-neutral-100 disabled:text-neutral-400 dark:bg-neutral-900 ${n.isRoot && !n.text.trim() ? "border-red-300" : "border-neutral-200 dark:border-neutral-700"}`}
        spellCheck={false}
      />
      <LinkPills text={n.text} onTextChange={(t) => updateText(n.id, t)} className="mt-1" />
    </div>
  );
}
