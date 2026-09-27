"use client";
import { Panel } from "@xyflow/react";
import { useTreeStore } from "@/lib/store";

/** Counts shown on the canvas: squares, arrows, text labels. */
export function StatsBadge() {
  const squares = useTreeStore((s) => s.doc.nodes.length);
  const arrows = useTreeStore((s) => s.doc.edges.length);
  const labels = useTreeStore((s) => s.doc.edges.filter((e) => e.label).length);
  return (
    <Panel position="top-center" className="!m-3">
      <div className="flex gap-3 rounded-md border border-neutral-200 bg-white/95 px-3 py-1.5 text-[12px] text-neutral-600 shadow dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-neutral-300">
        <span><b>{squares}</b> squares</span>
        <span><b>{arrows}</b> arrows</span>
        <span><b>{labels}</b> text labels</span>
      </div>
    </Panel>
  );
}
