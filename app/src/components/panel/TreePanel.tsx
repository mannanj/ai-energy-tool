"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTreeStore } from "@/lib/store";
import { deriveTree, orderedNodes } from "@/lib/derive";
import { NodeRow } from "./NodeRow";
import { LinkPills } from "@/components/LinkPills";
import { HistoryView } from "./HistoryView";
import { ChatsView } from "./ChatsView";

const ADD_PLACEHOLDER =
  "Add a square. Paste or type text and links here, for example a question, an answer, a phone number, or a source URL like https://www.dss.virginia.gov/relief/pipp/. Links become pills you can copy and share. Press Cmd/Ctrl+Enter to add.";

interface Props {
  popout?: boolean;
}

export function TreePanel({ popout = false }: Props) {
  const doc = useTreeStore((s) => s.doc);
  const selectedNodeId = useTreeStore((s) => s.selectedNodeId);
  const { addNode, addChild, setPanelOpen, setPanelExpanded, setPanelWidth } = useTreeStore.getState();
  const expanded = useTreeStore((s) => s.panelExpanded);
  const width = useTreeStore((s) => s.panelWidth);

  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState("");
  const [attach, setAttach] = useState(true);
  const view = useTreeStore((s) => s.panelView);
  const setView = useTreeStore((s) => s.setPanelView);

  const derived = useMemo(() => deriveTree(doc), [doc]);
  const list = useMemo(() => orderedNodes(derived, doc.tree.rootNodeId), [derived, doc.tree.rootNodeId]);
  const q = filter.trim().toLowerCase();
  const matches = (t: string) => !q || t.toLowerCase().includes(q);

  const submit = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    const st = useTreeStore.getState();
    if (attach && st.selectedNodeId) addChild(st.selectedNodeId, text);
    else {
      const maxY = Math.max(...st.doc.nodes.map((n) => n.y + n.height), 0);
      addNode({ x: 0, y: maxY + 100 }, text);
    }
    setDraft("");
  }, [draft, attach, addChild, addNode]);

  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  const onResizeStart = (e: React.MouseEvent) => {
    dragRef.current = { startX: e.clientX, startW: width };
    const move = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setPanelWidth(Math.min(window.innerWidth - 80, dragRef.current.startW + (dragRef.current.startX - ev.clientX)));
    };
    const up = () => { dragRef.current = null; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const openPopout = () => {
    window.open("/panel", "aet-panel", "popup=yes,width=720,height=900");
  };

  const style = popout ? { width: "100%" } : { width: expanded ? "calc(100vw - 72px)" : width };
  const selectedText = doc.nodes.find((n) => n.id === selectedNodeId)?.text.trim();

  return (
    <aside
      style={style}
      className="relative flex h-full shrink-0 flex-col border-l border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900"
    >
      {!popout && (
        <div onMouseDown={onResizeStart} title="Drag to resize" className="absolute left-0 top-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-sky-300/60" />
      )}

      <div className="flex items-center gap-1 border-b border-neutral-200 px-3 py-2 dark:border-neutral-700">
        <span className="flex rounded border border-neutral-200 text-[12px] dark:border-neutral-700">
          {(["chats", "tree", "history"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`px-2.5 py-0.5 ${view === v ? "bg-neutral-100 font-medium dark:bg-neutral-800" : ""}`}>{v === "chats" ? "Chat" : v === "tree" ? "Tree" : "History"}</button>
          ))}
        </span>
        {!popout && (
          <span className="ml-auto flex items-center gap-0.5">
            <button title={expanded ? "Restore width" : "Expand to full width"} onClick={() => setPanelExpanded(!expanded)} className="rounded p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
              {expanded ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
              )}
            </button>
            <button title="Open in a new window" onClick={openPopout} className="rounded p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14 21 3"/></svg>
            </button>
            <button title="Close panel" onClick={() => setPanelOpen(false)} className="rounded p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">✕</button>
          </span>
        )}
      </div>

      {view === "history" && <HistoryView />}
      {view === "chats" && <ChatsView />}
      {view === "tree" && <>
      <div className="border-b border-neutral-200 p-3 dark:border-neutral-700">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder={ADD_PLACEHOLDER}
          rows={4}
          className="w-full resize-y rounded border border-neutral-200 bg-white px-2 py-1.5 text-[13px] leading-snug outline-none placeholder:text-neutral-400 focus:border-sky-400 dark:border-neutral-700 dark:bg-neutral-900"
          spellCheck={false}
        />
        <LinkPills text={draft} onTextChange={setDraft} className="mt-1" />
        <div className="mt-2 flex items-center gap-2 text-[12px]">
          <label className="flex items-center gap-1 text-neutral-600 dark:text-neutral-300">
            <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} />
            connect under selected{selectedText ? `: "${selectedText.slice(0, 28)}${selectedText.length > 28 ? "…" : ""}"` : selectedNodeId ? "" : " (none selected)"}
          </label>
          <button onClick={submit} disabled={!draft.trim()} className="ml-auto rounded bg-sky-600 px-3 py-1 text-white hover:bg-sky-700 disabled:opacity-40">Add square</button>
        </div>
      </div>

      <div className="px-3 py-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter squares by text or link…"
          className="w-full rounded border border-neutral-200 bg-white px-2 py-1 text-[13px] outline-none focus:border-sky-400 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-6">
        {list.map((d) => (
          <NodeRow key={d.node.id} d={d} dim={!matches(d.node.text)} />
        ))}
      </div>
      </>}
    </aside>
  );
}
