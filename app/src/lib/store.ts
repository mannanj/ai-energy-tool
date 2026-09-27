"use client";
import { create } from "zustand";
import type { TreeDocument, TreeNode, TreeEdge, NodeId, EdgeId } from "@/types/tree";
import { emptyDocument, exampleDocument, mkEdge, mkNode, NODE_H, NODE_W } from "./seed";

/**
 * Single-user store. State lives in memory, mirrors to localStorage on every change,
 * and re-hydrates when another window (the pop-out panel) writes to localStorage.
 * In the multiplayer build this file is replaced by a Yjs/partyserver binding with the same API.
 */

const STORAGE_KEY = "aet:doc:v1";
const now = () => new Date().toISOString();

interface State {
  doc: TreeDocument;
  hydrated: boolean;
  selectedNodeId: NodeId | null;
  selectedEdgeId: EdgeId | null;
  /** node whose textarea should grab focus once (set by addNode/addChild) */
  focusNodeId: NodeId | null;
  panelOpen: boolean;
  panelWidth: number; // px
  panelExpanded: boolean;

  hydrate: () => void;
  replaceDoc: (doc: TreeDocument) => void;
  resetEmpty: () => void;
  loadExample: () => void;

  addNode: (pos: { x: number; y: number }, text?: string) => NodeId;
  addChild: (parentId: NodeId, text?: string) => NodeId;
  updateNodeText: (id: NodeId, text: string) => void;
  moveNode: (id: NodeId, x: number, y: number) => void;
  resizeNode: (id: NodeId, width: number, height: number) => void;
  deleteNode: (id: NodeId) => void;

  addEdge: (source: NodeId, target: NodeId) => void;
  setEdgeLabel: (id: EdgeId, label: string) => void;
  deleteEdge: (id: EdgeId) => void;

  select: (nodeId: NodeId | null, edgeId?: EdgeId | null) => void;
  clearFocus: () => void;
  setPanelOpen: (v: boolean) => void;
  setPanelWidth: (px: number) => void;
  setPanelExpanded: (v: boolean) => void;
}

let lastWritten = "";
function persist(doc: TreeDocument) {
  if (typeof window === "undefined") return;
  try {
    const s = JSON.stringify(doc);
    lastWritten = s;
    localStorage.setItem(STORAGE_KEY, s);
  } catch (e) {
    console.error("persist failed", e);
  }
}

function load(): TreeDocument | null {
  if (typeof window === "undefined") return null;
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s || s === lastWritten) return null;
    lastWritten = s;
    const d = JSON.parse(s) as TreeDocument;
    return d.version === 1 ? d : null;
  } catch {
    return null;
  }
}

export const useTreeStore = create<State>((set, get) => {
  const commit = (mut: (d: TreeDocument) => void) => {
    const doc: TreeDocument = structuredClone(get().doc);
    mut(doc);
    doc.tree.updatedAt = now();
    persist(doc);
    set({ doc });
  };

  return {
    doc: emptyDocument(),
    hydrated: false,
    selectedNodeId: null,
    selectedEdgeId: null,
    focusNodeId: null,
    panelOpen: false,
    panelWidth: 420,
    panelExpanded: false,

    hydrate: () => {
      const d = load();
      if (d) set({ doc: d, hydrated: true });
      else if (!get().hydrated) {
        persist(get().doc);
        set({ hydrated: true });
      }
    },
    replaceDoc: (doc) => { persist(doc); set({ doc, selectedNodeId: null, selectedEdgeId: null }); },
    resetEmpty: () => get().replaceDoc(emptyDocument()),
    loadExample: () => get().replaceDoc(exampleDocument()),

    addNode: (pos, text = "") => {
      const existing = get().doc.nodes;
      const overlaps = (x: number, y: number) =>
        existing.some((o) => x < o.x + o.width + 20 && x + NODE_W + 20 > o.x && y < o.y + o.height + 20 && y + NODE_H + 20 > o.y);
      let { x, y } = pos;
      for (let i = 0; i < 50 && overlaps(x, y); i++) y += NODE_H + 40;
      const n = mkNode(get().doc.tree.id, { x, y, text, width: NODE_W, height: NODE_H });
      commit((d) => { d.nodes.push(n); });
      set({ selectedNodeId: n.id, selectedEdgeId: null, focusNodeId: n.id });
      return n.id;
    },
    addChild: (parentId, text = "") => {
      const d0 = get().doc;
      const parent = d0.nodes.find((n) => n.id === parentId);
      if (!parent) return get().addNode({ x: 0, y: 0 }, text);
      const siblings = d0.edges.filter((e) => e.source === parentId).length;
      const n = mkNode(d0.tree.id, {
        x: parent.x + siblings * (NODE_W + 40),
        y: parent.y + parent.height + 100,
        text,
      });
      const e = mkEdge(d0.tree.id, parentId, n.id);
      commit((d) => { d.nodes.push(n); d.edges.push(e); });
      set({ selectedNodeId: n.id, selectedEdgeId: null, focusNodeId: n.id });
      return n.id;
    },
    updateNodeText: (id, text) =>
      commit((d) => {
        const n = d.nodes.find((x) => x.id === id);
        if (n && n.text !== text) { n.text = text; n.updatedAt = now(); }
      }),
    moveNode: (id, x, y) =>
      commit((d) => {
        const n = d.nodes.find((x) => x.id === id);
        if (n) { n.x = x; n.y = y; n.updatedAt = now(); }
      }),
    resizeNode: (id, width, height) =>
      commit((d) => {
        const n = d.nodes.find((x) => x.id === id);
        if (n) { n.width = Math.round(width); n.height = Math.round(height); n.updatedAt = now(); }
      }),
    deleteNode: (id) => {
      if (get().doc.nodes.find((n) => n.id === id)?.isRoot) return; // root is required
      commit((d) => {
        d.nodes = d.nodes.filter((n) => n.id !== id);
        d.edges = d.edges.filter((e) => e.source !== id && e.target !== id);
      });
      if (get().selectedNodeId === id) set({ selectedNodeId: null });
    },

    addEdge: (source, target) => {
      if (source === target) return;
      const d0 = get().doc;
      if (d0.edges.some((e) => e.source === source && e.target === target)) return;
      commit((d) => { d.edges.push(mkEdge(d.tree.id, source, target)); });
    },
    setEdgeLabel: (id, label) =>
      commit((d) => {
        const e = d.edges.find((x) => x.id === id);
        if (e) e.label = label.trim() || undefined;
      }),
    deleteEdge: (id) => commit((d) => { d.edges = d.edges.filter((e) => e.id !== id); }),

    select: (nodeId, edgeId = null) => set({ selectedNodeId: nodeId, selectedEdgeId: edgeId }),
    clearFocus: () => set({ focusNodeId: null }),
    setPanelOpen: (v) => set({ panelOpen: v }),
    setPanelWidth: (px) => set({ panelWidth: Math.max(280, px) }),
    setPanelExpanded: (v) => set({ panelExpanded: v }),
  };
});

/** Call once per window: hydrate from localStorage and follow writes from other windows. */
export function attachStorageSync() {
  const s = useTreeStore.getState();
  s.hydrate();
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) useTreeStore.getState().hydrate();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

export type { TreeNode, TreeEdge };
