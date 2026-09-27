"use client";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow, Background, BackgroundVariant, MarkerType, MiniMap, useReactFlow,
  type Connection, type Edge, type EdgeChange, type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTreeStore } from "@/lib/store";
import { deriveTree } from "@/lib/derive";
import { SquareNode, type SquareNodeType } from "@/components/nodes/SquareNode";
import { LabeledEdge } from "./LabeledEdge";
import { Toolbar } from "./Toolbar";
import { StatsBadge } from "./StatsBadge";
import { Cursors } from "./Cursors";
import { NODE_H, NODE_W } from "@/lib/seed";

const nodeTypes = { square: SquareNode };
const edgeTypes = { labeled: LabeledEdge };

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
  const { moveNode, resizeNode, addEdge, select, addNode, addChild, deleteNode, deleteEdge } = useTreeStore.getState();

  const derived = useMemo(() => deriveTree(doc), [doc]);

  const nodes: SquareNodeType[] = useMemo(
    () =>
      doc.nodes.map((n) => ({
        id: n.id,
        type: "square" as const,
        position: { x: n.x, y: n.y },
        width: n.width,
        height: n.height,
        selected: n.id === selectedNodeId,
        deletable: !n.isRoot,
        data: { text: n.text, isRoot: n.isRoot, number: derived.get(n.id)?.number ?? "", autoFocus: focusNodeId === n.id },
      })),
    [doc.nodes, derived, selectedNodeId, focusNodeId],
  );

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

  // Node moves and removals are applied to the store; React Flow itself stays controlled.
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    for (const c of changes) {
      if (c.type === "position" && c.position && !c.dragging) moveNode(c.id, c.position.x, c.position.y);
      else if (c.type === "position" && c.position && c.dragging) {
        // live drag: update store so the panel/pop-out follow; cheap enough for a tree this size
        moveNode(c.id, c.position.x, c.position.y);
      } else if (c.type === "dimensions" && c.dimensions && c.resizing) resizeNode(c.id, c.dimensions.width, c.dimensions.height);
      else if (c.type === "remove") deleteNode(c.id);
      else if (c.type === "select") {
        const st = useTreeStore.getState();
        if (c.selected) select(c.id, null);
        else if (st.selectedNodeId === c.id) select(null, st.selectedEdgeId);
      }
    }
  }, [moveNode, deleteNode, resizeNode, select]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    for (const c of changes) {
      if (c.type === "remove") deleteEdge(c.id);
      else if (c.type === "select") {
        const st = useTreeStore.getState();
        if (c.selected) select(null, c.id);
        else if (st.selectedEdgeId === c.id) select(st.selectedNodeId, null);
      }
    }
  }, [deleteEdge, select]);

  const onConnect = useCallback((c: Connection) => { if (c.source && c.target) addEdge(c.source, c.target); }, [addEdge]);

  // Keyboard shortcuts (ignored while typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.tagName === "TEXTAREA" || t.tagName === "INPUT";
      if (typing && e.key === "Escape") { t.blur(); return; }
      if (typing && e.key === "Tab") return; // let textarea/panel handle tab
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
      nodes={nodes}
      edges={edges}
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
      <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} />
      <MiniMap pannable zoomable className="!bottom-3 !right-3 !h-24 !w-40 opacity-80" nodeStrokeWidth={2} />
      <Toolbar />
      <StatsBadge />
      <Cursors />
    </ReactFlow>
  );
}

export { NODE_H, NODE_W };
