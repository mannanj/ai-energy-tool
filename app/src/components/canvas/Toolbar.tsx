"use client";
import { Panel, useReactFlow } from "@xyflow/react";
import { useTreeStore } from "@/lib/store";
import { NODE_H, NODE_W } from "@/lib/seed";

function Btn({ title, onClick, children, disabled }: { title: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 dark:text-neutral-200 dark:hover:bg-neutral-800"
    >
      {children}
    </button>
  );
}

/** Fixed single-column toolbar on the left. Screen-fixed: unaffected by zoom or pan. */
export function Toolbar() {
  const rf = useReactFlow();
  const addNode = useTreeStore((s) => s.addNode);
  const addChild = useTreeStore((s) => s.addChild);
  const deleteNode = useTreeStore((s) => s.deleteNode);
  const deleteEdge = useTreeStore((s) => s.deleteEdge);
  const selectedNodeId = useTreeStore((s) => s.selectedNodeId);
  const selectedEdgeId = useTreeStore((s) => s.selectedEdgeId);
  const loadExample = useTreeStore((s) => s.loadExample);
  const resetEmpty = useTreeStore((s) => s.resetEmpty);
  const isRootSelected = useTreeStore((s) => s.doc.nodes.find((n) => n.id === s.selectedNodeId)?.isRoot ?? false);

  const addAtCenter = () => {
    const el = document.querySelector(".react-flow") as HTMLElement | null;
    const r = el?.getBoundingClientRect();
    const c = rf.screenToFlowPosition({ x: (r?.left ?? 0) + (r?.width ?? 800) / 2, y: (r?.top ?? 0) + (r?.height ?? 600) / 2 });
    addNode({ x: c.x - NODE_W / 2 + (Math.random() * 40 - 20), y: c.y - NODE_H / 2 + (Math.random() * 40 - 20) });
  };

  return (
    <Panel position="top-left" className="!m-3">
      <div className="flex flex-col gap-0.5 rounded-lg border border-neutral-200 bg-white/95 p-1 shadow-md backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/95">
        <Btn title="Add square (S)" onClick={addAtCenter}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
        </Btn>
        <Btn title="Add connected child below selected (Tab)" onClick={() => selectedNodeId && addChild(selectedNodeId)} disabled={!selectedNodeId}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="7" y="2" width="10" height="7" rx="1.5"/><rect x="7" y="15" width="10" height="7" rx="1.5"/><path d="M12 9v6"/><path d="m9.5 12.5 2.5 2.5 2.5-2.5"/></svg>
        </Btn>
        <Btn title="Delete selected (Delete)" onClick={() => { if (selectedNodeId) deleteNode(selectedNodeId); else if (selectedEdgeId) deleteEdge(selectedEdgeId); }} disabled={(!selectedNodeId && !selectedEdgeId) || isRootSelected}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
        </Btn>
        <div className="my-0.5 h-px bg-neutral-200 dark:bg-neutral-700" />
        <Btn title="Zoom in (=)" onClick={() => rf.zoomIn()}>＋</Btn>
        <Btn title="Zoom out (-)" onClick={() => rf.zoomOut()}>－</Btn>
        <Btn title="Fit to tree (F)" onClick={() => rf.fitView({ padding: 0.2, duration: 300 })}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>
        </Btn>
        <div className="my-0.5 h-px bg-neutral-200 dark:bg-neutral-700" />
        <Btn title="Load example tree (Fairfax / Dominion)" onClick={() => { if (confirm("Replace the canvas with the example tree?")) { loadExample(); setTimeout(() => rf.fitView({ padding: 0.2 }), 50); } }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v4M5 21v-4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4"/><rect x="8" y="7" width="8" height="6" rx="1"/></svg>
        </Btn>
        <Btn title="New empty canvas" onClick={() => { if (confirm("Clear the canvas? This cannot be undone.")) { resetEmpty(); setTimeout(() => rf.fitView({ padding: 0.5 }), 50); } }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>
        </Btn>
      </div>
    </Panel>
  );
}
