"use client";
import { useMemo } from "react";
import { create } from "zustand";
import * as Y from "yjs";
import YProvider from "y-partyserver/provider";
import { Awareness } from "y-protocols/awareness";
import type { TreeDocument, TreeNode, TreeEdge, NodeId, EdgeId, NodeLock, TreeInfo } from "@/types/tree";
import { listSources, sourceScrollTop, type PdfLayout, type SourceItem } from "./sources";
import { LOCK_TIMEOUT_MS } from "@/types/tree";
import { exampleDocument, mkEdge, mkNode, NODE_H, NODE_W } from "./seed";
import { api, currentTreeId, fullName, partyHost, treeHref, WORKER_ORIGIN, type Me } from "./api";

export interface Peer {
  clientId: number;
  user: { id: string; name: string; color: string };
  cursor: { x: number; y: number } | null;
  editingNodeId: NodeId | null;
}

export interface SourcePick { nodeId: NodeId; index: number }

interface State {
  treeId: string;
  trees: TreeInfo[];
  doc: TreeDocument;
  hydrated: boolean;
  connected: boolean;
  me: Me | null;
  peers: Peer[];
  locks: Record<NodeId, NodeLock>;
  bubblePos: Record<string, { x: number; y: number }>;
  now: number;

  selectedNodeId: NodeId | null;
  selectedEdgeId: EdgeId | null;
  focusNodeId: NodeId | null;
  panelOpen: boolean;
  panelWidth: number;
  panelExpanded: boolean;
  panelView: "tree" | "history" | "chats";

  pdfOpen: boolean;
  pdfPos: { x: number; y: number } | null;
  pdfScrollTop: number;
  pdfLayout: PdfLayout | null;
  hoverSource: SourcePick | null;
  activeSource: (SourcePick & { n: number }) | null;
  pdfScrollTo: number | null;

  connect: (me: Me) => () => void;
  loadTrees: () => Promise<void>;
  createTree: (name: string, seed?: "empty" | "example" | "civic-signal") => Promise<string | null>;
  uploadPdf: (file: File) => Promise<boolean>;
  resetEmpty: () => void;
  loadExample: () => void;

  setPdfOpen: (v: boolean) => void;
  setPdfPos: (x: number, y: number) => void;
  setPdfScrollTop: (top: number) => void;
  setPdfLayout: (l: PdfLayout | null) => void;
  setHoverSource: (s: SourcePick | null) => void;
  jumpToSource: (nodeId: NodeId, index: number) => void;
  clearPdfScrollTo: () => void;

  addNode: (pos: { x: number; y: number }, text?: string) => NodeId;
  addChild: (parentId: NodeId, text?: string) => NodeId;
  updateNodeText: (id: NodeId, text: string) => void;
  moveNode: (id: NodeId, x: number, y: number) => void;
  resizeNode: (id: NodeId, width: number, height: number) => void;
  deleteNode: (id: NodeId) => void;
  addEdge: (source: NodeId, target: NodeId) => void;
  setEdgeLabel: (id: EdgeId, label: string) => void;
  deleteEdge: (id: EdgeId) => void;

  acquireLock: (nodeId: NodeId) => boolean;
  touchLock: (nodeId: NodeId) => void;
  releaseLock: (nodeId: NodeId) => void;
  setCursor: (pos: { x: number; y: number } | null) => void;
  moveBubble: (key: string, x: number, y: number) => void;

  select: (nodeId: NodeId | null, edgeId?: EdgeId | null) => void;
  clearFocus: () => void;
  setPanelOpen: (v: boolean) => void;
  setPanelWidth: (px: number) => void;
  setPanelExpanded: (v: boolean) => void;
  setPanelView: (v: "tree" | "history" | "chats") => void;
}

const now = () => new Date().toISOString();
const emptyDoc = (id: string): TreeDocument => ({ version: 1, tree: { id, name: "", rootNodeId: "", createdAt: "", updatedAt: "" }, nodes: [], edges: [] });

let ydoc: Y.Doc | null = null;
let provider: YProvider | null = null;
let awareness: Awareness | null = null;
const maps = () => {
  if (!ydoc) throw new Error("not connected");
  return { meta: ydoc.getMap<unknown>("meta"), nodes: ydoc.getMap<TreeNode>("nodes"), edges: ydoc.getMap<TreeEdge>("edges"), locks: ydoc.getMap<NodeLock>("locks"), bubbles: ydoc.getMap<{ x: number; y: number }>("bubbles") };
};

export function isLockActive(lock: NodeLock | undefined, at = Date.now()): lock is NodeLock {
  return !!lock && at - Date.parse(lock.lastActivityAt) < LOCK_TIMEOUT_MS;
}

export const useTreeStore = create<State>((set, get) => {
  const readDoc = (): TreeDocument => {
    const { meta, nodes, edges } = maps();
    return {
      version: 1,
      tree: { id: get().treeId, name: String(meta.get("name") ?? ""), rootNodeId: String(meta.get("rootNodeId") ?? ""), createdAt: String(meta.get("createdAt") ?? ""), updatedAt: String(meta.get("updatedAt") ?? "") },
      nodes: [...nodes.values()],
      edges: [...edges.values()],
    };
  };
  const readLocks = () => Object.fromEntries(maps().locks.entries()) as Record<NodeId, NodeLock>;
  const readBubbles = () => Object.fromEntries(maps().bubbles.entries());
  const refresh = () => set({ doc: readDoc(), locks: readLocks(), bubblePos: readBubbles() });
  const tx = (fn: () => void) => { ydoc!.transact(fn, "local"); maps().meta.set("updatedAt", now()); };
  const meId = () => get().me?.id;
  const patchNode = (id: NodeId, patch: Partial<TreeNode>) => {
    const { nodes } = maps();
    const n = nodes.get(id);
    if (!n) return;
    tx(() => nodes.set(id, { ...n, ...patch, updatedAt: now(), updatedBy: meId() }));
  };
  const setLocalAwareness = (patch: Partial<Peer>) => {
    if (!awareness) return;
    awareness.setLocalState({ ...(awareness.getLocalState() ?? {}), ...patch });
  };

  return {
    treeId: "main",
    trees: [],
    doc: emptyDoc("main"),
    hydrated: false,
    connected: false,
    me: null,
    peers: [],
    locks: {},
    bubblePos: {},
    now: Date.now(),
    selectedNodeId: null,
    selectedEdgeId: null,
    focusNodeId: null,
    panelOpen: false,
    panelWidth: 420,
    panelExpanded: false,
    panelView: "tree",
    pdfOpen: false,
    pdfPos: null,
    pdfScrollTop: 0,
    pdfLayout: null,
    hoverSource: null,
    activeSource: null,
    pdfScrollTo: null,

    connect: (me) => {
      if (provider) provider.destroy();
      const treeId = currentTreeId();
      ydoc = new Y.Doc();
      awareness = new Awareness(ydoc);
      awareness.setLocalState({ user: { id: me.id, name: fullName(me), color: me.color }, cursor: null, editingNodeId: null });
      provider = new YProvider(partyHost(), treeId, ydoc, { party: "tree-room", awareness });
      set({ me, treeId, doc: emptyDoc(treeId) });
      get().loadTrees();

      const { nodes, edges, meta, locks, bubbles } = maps();
      const onChange = () => refresh();
      nodes.observe(onChange); edges.observe(onChange); meta.observe(onChange); locks.observe(onChange); bubbles.observe(onChange);
      provider.on("sync", (synced: boolean) => { if (synced) { refresh(); set({ hydrated: true }); } });
      provider.on("status", (e: { status: string }) => set({ connected: e.status === "connected" }));

      const onAwareness = () => {
        const states = awareness!.getStates();
        const peers: Peer[] = [];
        const present = new Set<string>();
        for (const [clientId, s] of states) {
          const st = s as Partial<Peer>;
          if (!st.user) continue;
          present.add(st.user.id);
          if (clientId === awareness!.clientID || st.user.id === me.id) continue;
          peers.push({ clientId, user: st.user, cursor: st.cursor ?? null, editingNodeId: st.editingNodeId ?? null });
        }
        set({ peers });
        if (get().hydrated) {
          for (const [nodeId, lock] of locks.entries()) {
            if (!present.has(lock.userId) && Date.now() - Date.parse(lock.lastActivityAt) > 10_000) tx(() => locks.delete(nodeId));
          }
        }
      };
      awareness.on("change", onAwareness);

      const tick = setInterval(() => set({ now: Date.now() }), 10_000);
      const onUnload = () => {
        const id = meId();
        for (const [nodeId, lock] of maps().locks.entries()) if (lock.userId === id) maps().locks.delete(nodeId);
        awareness?.setLocalState(null);
      };
      window.addEventListener("beforeunload", onUnload);

      return () => {
        clearInterval(tick);
        window.removeEventListener("beforeunload", onUnload);
        onUnload();
        provider?.destroy(); provider = null; awareness = null; ydoc?.destroy(); ydoc = null;
        set({ hydrated: false, connected: false, peers: [] });
      };
    },

    loadTrees: async () => {
      const { status, data } = await api<{ trees: TreeInfo[] }>("/api/trees");
      if (status === 200) set({ trees: data.trees ?? [] });
    },
    createTree: async (name, seed = "empty") => {
      const { status, data } = await api<{ ok?: boolean; id?: string; error?: string }>("/api/trees", { method: "POST", body: JSON.stringify({ name, seed }) });
      if (status !== 200 || !data.id) { alert(data.error ?? "Could not create the tree"); return null; }
      window.location.href = treeHref(data.id);
      return data.id;
    },
    uploadPdf: async (file) => {
      const res = await fetch(`${WORKER_ORIGIN}/api/tree/${get().treeId}/pdf`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/pdf" }, body: file });
      if (!res.ok) { alert("The PDF could not be uploaded"); return false; }
      await get().loadTrees();
      set({ pdfOpen: true, pdfLayout: null, pdfScrollTop: 0 });
      return true;
    },
    resetEmpty: () => {
      const { nodes, edges, locks, meta } = maps();
      const root = mkNode(get().treeId, { x: 0, y: 0, isRoot: true, width: 360, height: 120 });
      tx(() => {
        nodes.clear(); edges.clear(); locks.clear();
        nodes.set(root.id, root);
        meta.set("rootNodeId", root.id);
      });
      set({ selectedNodeId: null, selectedEdgeId: null });
    },
    loadExample: () => {
      const ex = exampleDocument();
      const { nodes, edges, locks, meta } = maps();
      const treeId = get().treeId;
      tx(() => {
        nodes.clear(); edges.clear(); locks.clear();
        for (const n of ex.nodes) nodes.set(n.id, { ...n, treeId });
        for (const e of ex.edges) edges.set(e.id, { ...e, treeId });
        meta.set("rootNodeId", ex.tree.rootNodeId); meta.set("name", ex.tree.name);
      });
      set({ selectedNodeId: null, selectedEdgeId: null });
    },

    setPdfOpen: (v) => set({ pdfOpen: v, hoverSource: null, activeSource: v ? get().activeSource : null }),
    setPdfPos: (x, y) => set({ pdfPos: { x: Math.round(x), y: Math.round(y) } }),
    setPdfScrollTop: (top) => set({ pdfScrollTop: top }),
    setPdfLayout: (l) => set({ pdfLayout: l }),
    setHoverSource: (h) => set({ hoverSource: h }),
    jumpToSource: (nodeId, index) => {
      const ref = get().doc.nodes.find((n) => n.id === nodeId)?.sources?.[index];
      if (!ref) return;
      const layout = get().pdfLayout;
      set({ pdfOpen: true, activeSource: { nodeId, index, n: (get().activeSource?.n ?? 0) + 1 }, pdfScrollTo: layout ? sourceScrollTop(layout, ref) : null });
    },
    clearPdfScrollTo: () => set({ pdfScrollTo: null }),

    addNode: (pos, text = "") => {
      const existing = get().doc.nodes;
      const overlaps = (x: number, y: number) =>
        existing.some((o) => x < o.x + o.width + 20 && x + NODE_W + 20 > o.x && y < o.y + o.height + 20 && y + NODE_H + 20 > o.y);
      let { x, y } = pos;
      for (let i = 0; i < 50 && overlaps(x, y); i++) y += NODE_H + 40;
      const n = mkNode(get().treeId, { x, y, text, width: NODE_W, height: NODE_H, createdBy: meId(), updatedBy: meId() });
      tx(() => maps().nodes.set(n.id, n));
      set({ selectedNodeId: n.id, selectedEdgeId: null, focusNodeId: n.id });
      return n.id;
    },
    addChild: (parentId, text = "") => {
      const parent = get().doc.nodes.find((n) => n.id === parentId);
      if (!parent) return get().addNode({ x: 0, y: 0 }, text);
      const siblings = get().doc.edges.filter((e) => e.source === parentId).length;
      const n = mkNode(get().treeId, { x: parent.x + siblings * (NODE_W + 40), y: parent.y + parent.height + 100, text, createdBy: meId(), updatedBy: meId() });
      const e = mkEdge(get().treeId, parentId, n.id);
      e.createdBy = meId();
      tx(() => { maps().nodes.set(n.id, n); maps().edges.set(e.id, e); });
      set({ selectedNodeId: n.id, selectedEdgeId: null, focusNodeId: n.id });
      return n.id;
    },
    updateNodeText: (id, text) => { patchNode(id, { text }); get().touchLock(id); },
    moveNode: (id, x, y) => patchNode(id, { x, y }),
    resizeNode: (id, width, height) => patchNode(id, { width: Math.round(width), height: Math.round(height) }),
    deleteNode: (id) => {
      const { nodes, edges, locks } = maps();
      if (nodes.get(id)?.isRoot) return;
      if (isLockActive(locks.get(id)) && locks.get(id)!.userId !== meId()) return;
      tx(() => {
        nodes.delete(id); locks.delete(id);
        for (const [eid, e] of edges.entries()) if (e.source === id || e.target === id) edges.delete(eid);
      });
      if (get().selectedNodeId === id) set({ selectedNodeId: null });
    },

    addEdge: (source, target) => {
      if (source === target) return;
      if (get().doc.edges.some((e) => e.source === source && e.target === target)) return;
      const e = mkEdge(get().treeId, source, target); e.createdBy = meId();
      tx(() => maps().edges.set(e.id, e));
    },
    setEdgeLabel: (id, label) => {
      const { edges } = maps();
      const e = edges.get(id);
      if (e) tx(() => edges.set(id, { ...e, label: label.trim() || undefined }));
    },
    deleteEdge: (id) => tx(() => maps().edges.delete(id)),

    acquireLock: (nodeId) => {
      const me = get().me; if (!me || !ydoc) return false;
      const { locks } = maps();
      const cur = locks.get(nodeId);
      if (isLockActive(cur) && cur.userId !== me.id) return false;
      const t = now();
      tx(() => locks.set(nodeId, { nodeId, userId: me.id, userName: fullName(me), lockedAt: cur?.userId === me.id ? cur.lockedAt : t, lastActivityAt: t }));
      setLocalAwareness({ editingNodeId: nodeId });
      return true;
    },
    touchLock: (nodeId) => {
      const me = get().me; if (!me || !ydoc) return;
      const { locks } = maps();
      const cur = locks.get(nodeId);
      if (!cur || cur.userId !== me.id) return;
      if (Date.now() - Date.parse(cur.lastActivityAt) < 3000) return;
      tx(() => locks.set(nodeId, { ...cur, lastActivityAt: now() }));
    },
    releaseLock: (nodeId) => {
      const me = get().me; if (!me || !ydoc) return;
      const { locks } = maps();
      if (locks.get(nodeId)?.userId === me.id) tx(() => locks.delete(nodeId));
      setLocalAwareness({ editingNodeId: null });
    },
    setCursor: (pos) => setLocalAwareness({ cursor: pos }),
    moveBubble: (key, x, y) => { if (!ydoc) return; ydoc.transact(() => maps().bubbles.set(key, { x: Math.round(x), y: Math.round(y) }), "local"); },

    select: (nodeId, edgeId = null) => set({ selectedNodeId: nodeId, selectedEdgeId: edgeId }),
    clearFocus: () => set({ focusNodeId: null }),
    setPanelOpen: (v) => set({ panelOpen: v }),
    setPanelWidth: (px) => set({ panelWidth: Math.max(280, px) }),
    setPanelExpanded: (v) => set({ panelExpanded: v }),
    setPanelView: (v) => set({ panelView: v }),
  };
});

export function useSources(): SourceItem[] {
  const doc = useTreeStore((s) => s.doc);
  return useMemo(() => listSources(doc), [doc]);
}

export function useLock(nodeId: NodeId): { lockedBy: NodeLock | null; mine: boolean } {
  const lock = useTreeStore((s) => s.locks[nodeId]);
  const me = useTreeStore((s) => s.me);
  const at = useTreeStore((s) => s.now);
  const active = isLockActive(lock, Math.max(at, Date.now()));
  if (!active) return { lockedBy: null, mine: false };
  return lock.userId === me?.id ? { lockedBy: null, mine: true } : { lockedBy: lock, mine: false };
}

export function formatLockTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export type { TreeNode, TreeEdge };
