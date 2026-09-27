"use client";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow, Background, BackgroundVariant, MarkerType, useReactFlow,
  type Connection, type Edge, type EdgeChange, type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTreeStore } from "@/lib/store";
import { deriveTree } from "@/lib/derive";
import { SquareNode, type SquareNodeType } from "@/components/nodes/SquareNode";
import { BubbleNode, type BubbleNodeType } from "@/components/nodes/BubbleNode";
import { LabeledEdge } from "./LabeledEdge";
import { ThreadEdge } from "./ThreadEdge";
import { AnchorEdge } from "./AnchorEdge";
import { chatColor, chatLabel, useChatStore } from "@/lib/chats";
import { Toolbar } from "./Toolbar";
import { StatsBadge } from "./StatsBadge";
import { Cursors } from "./Cursors";
import { NODE_H, NODE_W } from "@/lib/seed";

const nodeTypes = { square: SquareNode, bubble: BubbleNode };
const edgeTypes = { labeled: LabeledEdge, thread: ThreadEdge, anchor: AnchorEdge };
const BUBBLE_GAP = 14, BUBBLE_COL = 314, BUBBLE_STACK = 30;
const spreadFor = (cols: number) => (cols ? 1 + (Math.min(cols, 4) * BUBBLE_COL) / 300 : 1);

export function TreeCanvas() {
  const doc = useTreeStore((s) => s.doc);
  const selectedNodeId = useTreeStore((s) => s.selectedNodeId);
  const selectedEdgeId = useTreeStore((s) => s.selectedEdgeId);
  const focusNodeId = useTreeStore((s) => s.focusNodeId);
  const rf = useReactFlow();
  const setCursor = useTreeStore((s) => s.setCursor);
  const rafRef = useRef<number | null>(null);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (rafRef.current) return;
    const { clientX, clientY } = e;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setCursor(rf.screenToFlowPosition({ x: clientX, y: clientY }));
    });
  }, [rf, setCursor]);
  const { moveNode, resizeNode, addEdge, select, addNode, addChild, deleteNode, deleteEdge, moveBubble } = useTreeStore.getState();
  const bubblePos = useTreeStore((s) => s.bubblePos);
  const inspectOn = useChatStore((s) => s.inspectOn);
  const chats = useChatStore((s) => s.chats);
  const shown = useChatStore((s) => s.shown);

  const derived = useMemo(() => deriveTree(doc), [doc]);
  const spread = inspectOn ? spreadFor(shown.length) : 1;
  const spreadRef = useRef(spread); spreadRef.current = spread;

  const hover = useChatStore((s) => s.hover);
  const focus = useChatStore((s) => s.focus);
  useEffect(() => {
    if (!focus) return;
    const present = focus.ids.filter((id) => rf.getNode(id));
    if (!present.length) return;
    rf.fitView({ nodes: present.map((id) => ({ id })), padding: 0.35, maxZoom: 1.2, duration: 450 });
  }, [focus, rf]);
  const bubbles = useMemo(() => {
    const nodesOut: BubbleNodeType[] = []; const edgesOut: Edge[] = [];
    if (!inspectOn) return { nodesOut, edgesOut };
    const sq = new Map(doc.nodes.map((n) => [n.id, n]));
    shown.forEach((cid, col) => {
      const c = chats.find((x) => x.id === cid); if (!c) return;
      const color = chatColor(shown, cid); const used: Record<string, number> = {};
      let prev: string | null = null; let pendingUser: typeof c.messages[number] | null = null; let first = true;
      for (const m of c.messages) {
        if (m.role === "user") { pendingUser = m; continue; }
        const sid = m.node_ids.find((x) => sq.has(x)); if (!sid) { pendingUser = null; continue; }
        const n = sq.get(sid)!; const k = (used[sid] = (used[sid] ?? 0) + 1);
        const base = { x: n.x * spread, y: n.y };
        const at = (seq: number, dx: number, dy: number) => { const saved = bubblePos[`${cid}:${seq}`]; return saved ? { x: base.x + saved.x, y: base.y + saved.y } : { x: base.x + dx, y: base.y + dy }; };
        const colX = n.width + BUBBLE_GAP + col * BUBBLE_COL, rowY = (k - 1) * BUBBLE_STACK;
        const push = (msg: typeof m, pos: { x: number; y: number }) => {
          const id = `b:${cid}:${msg.seq}`;
          nodesOut.push({ id, type: "bubble", draggable: true, selectable: false, connectable: false, deletable: false, zIndex: 5, position: pos,
            data: { chatId: cid, seq: msg.seq, role: msg.role, color, text: msg.content, nodeIds: msg.node_ids, review: msg.review, label: first && shown.length > 1 ? chatLabel(c) + " · " + cid : null, hot: !!hover && hover.chatId === cid && (hover.seq == null || hover.seq === msg.seq) } });
          first = false;
          if (prev) edgesOut.push({ id: `t:${prev}:${id}`, source: prev, target: id, type: "thread", selectable: false, deletable: false, focusable: false, data: { color } });
          if (msg.role === "assistant") edgesOut.push({ id: `a:${id}`, source: id, sourceHandle: "anchor", target: sid, targetHandle: "anchor", type: "anchor", selectable: false, deletable: false, focusable: false, zIndex: 4 });
          prev = id;
        };
        if (pendingUser) push(pendingUser, at(pendingUser.seq, colX, rowY - 70));
        push(m, at(m.seq, colX, rowY));
        pendingUser = null;
      }
    });
    return { nodesOut, edgesOut };
  }, [inspectOn, chats, shown, doc.nodes, bubblePos, spread, hover]);
  const squareOf = useCallback((bubbleKey: string) => {
    const [cid, seqS] = bubbleKey.split(":"); const seq = Number(seqS);
    const msgs = chats.find((c) => c.id === cid)?.messages ?? [];
    const m = msgs.find((x) => x.seq >= seq && x.role === "assistant");
    return doc.nodes.find((n) => m?.node_ids.includes(n.id)) ?? null;
  }, [chats, doc.nodes]);
  const pathIds = useMemo(() => {
    if (!inspectOn) return new Set<string>();
    const ids = new Set<string>();
    for (const cid of shown) for (const m of chats.find((x) => x.id === cid)?.messages ?? []) for (const n of m.node_ids) ids.add(n);
    return ids;
  }, [inspectOn, chats, shown]);

  const nodes: SquareNodeType[] = useMemo(
    () =>
      doc.nodes.map((n) => ({
        id: n.id,
        type: "square" as const,
        position: { x: n.x * spread, y: n.y },
        width: n.width,
        height: n.height,
        selected: n.id === selectedNodeId,
        deletable: !n.isRoot,
        data: { text: n.text, isRoot: n.isRoot, number: derived.get(n.id)?.number ?? "", autoFocus: focusNodeId === n.id, onPath: pathIds.has(n.id), hole: inspectOn && !n.text.trim() && !n.isRoot },
      })),
    [doc.nodes, derived, selectedNodeId, focusNodeId, pathIds, inspectOn, spread],
  );
  const allNodes = useMemo(() => [...nodes, ...bubbles.nodesOut] as (SquareNodeType | BubbleNodeType)[], [nodes, bubbles]);

  const edges: Edge[] = useMemo(
    () =>
      doc.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: "labeled",
        label: e.label,
        selected: e.id === selectedEdgeId,
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: e.id === selectedEdgeId ? "#0ea5e9" : "#737373" },
      })),
    [doc.edges, selectedEdgeId],
  );
  const allEdges = useMemo(() => [...edges, ...bubbles.edgesOut], [edges, bubbles]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    for (const c of changes) {
      const k = spreadRef.current;
      if ("id" in c && c.id.startsWith("b:")) {
        if (c.type === "position" && c.position && !c.dragging) { const sq = squareOf(c.id.slice(2)); if (sq) moveBubble(c.id.slice(2), c.position.x - sq.x * k, c.position.y - sq.y); }
        continue;
      }
      if (c.type === "position" && c.position && !c.dragging) moveNode(c.id, c.position.x / k, c.position.y);
      else if (c.type === "position" && c.position && c.dragging) {
        moveNode(c.id, c.position.x / k, c.position.y);
      } else if (c.type === "dimensions" && c.dimensions && c.resizing) resizeNode(c.id, c.dimensions.width, c.dimensions.height);
      else if (c.type === "remove") deleteNode(c.id);
      else if (c.type === "select") {
        const st = useTreeStore.getState();
        if (c.selected) select(c.id, null);
        else if (st.selectedNodeId === c.id) select(null, st.selectedEdgeId);
      }
    }
  }, [moveNode, deleteNode, resizeNode, select, moveBubble, squareOf]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    for (const c of changes) {
      if ("id" in c && c.id.startsWith("t:")) continue;
      if (c.type === "remove") deleteEdge(c.id);
      else if (c.type === "select") {
        const st = useTreeStore.getState();
        if (c.selected) select(null, c.id);
        else if (st.selectedEdgeId === c.id) select(st.selectedNodeId, null);
      }
    }
  }, [deleteEdge, select]);

  const onConnect = useCallback((c: Connection) => { if (c.source && c.target) addEdge(c.source, c.target); }, [addEdge]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.tagName === "TEXTAREA" || t.tagName === "INPUT";
      if (typing && e.key === "Escape") { t.blur(); return; }
      if (typing && e.key === "Tab") return;
      if (typing) return;
      if (e.metaKey || e.ctrlKey) return;
      const st = useTreeStore.getState();
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        const sel = st.doc.nodes.find((n) => n.id === st.selectedNodeId);
        addNode(sel ? { x: sel.x + sel.width + 60, y: sel.y } : { x: 0, y: 0 });
      } else if (e.key === "Tab" && st.selectedNodeId) {
        e.preventDefault();
        addChild(st.selectedNodeId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addNode, addChild]);

  return (
    <ReactFlow
      nodes={allNodes}
      edges={allEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onPaneClick={() => select(null, null)}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setCursor(null)}
      fitView
      fitViewOptions={{ padding: 0.4, maxZoom: 1 }}
      minZoom={0.02}
      maxZoom={24}
      zoomOnScroll
      panOnScroll={false}
      panOnDrag
      selectionOnDrag={false}
      deleteKeyCode={["Delete", "Backspace"]}
      defaultEdgeOptions={{ type: "labeled" }}
      connectionLineStyle={{ stroke: "#0ea5e9", strokeWidth: 1.6 }}
      proOptions={{ hideAttribution: true }}
      className="bg-neutral-50 dark:bg-neutral-950"
      style={{ ["--xy-node-border-default" as string]: "transparent" }}
    >
      <Background variant={BackgroundVariant.Lines} gap={24} lineWidth={1} color="rgba(128,128,128,0.28)" />
      <Toolbar />
      <StatsBadge />
      <Cursors />
    </ReactFlow>
  );
}

export { NODE_H, NODE_W };
