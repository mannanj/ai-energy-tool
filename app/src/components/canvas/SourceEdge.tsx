"use client";
import { BaseEdge, type Edge, type EdgeProps } from "@xyflow/react";
import { useTreeStore } from "@/lib/store";
import { sourcePoint } from "@/lib/sources";
import type { SourceRef } from "@/types/tree";

export type SourceEdgeData = { nodeId: string; index: number; n: number; ref: SourceRef };
export type SourceEdgeType = Edge<SourceEdgeData, "source">;

const LABEL_H = 20;

export function SourceEdge({ id, sourceX, sourceY, data }: EdgeProps<SourceEdgeType>) {
  const pdfPos = useTreeStore((s) => s.pdfPos);
  const layout = useTreeStore((s) => s.pdfLayout);
  const scrollTop = useTreeStore((s) => s.pdfScrollTop);
  const hover = useTreeStore((s) => s.hoverSource);
  const active = useTreeStore((s) => s.activeSource);
  const setHover = useTreeStore((s) => s.setHoverSource);
  const jump = useTreeStore((s) => s.jumpToSource);
  if (!data || !pdfPos) return null;
  const target = sourcePoint(layout, pdfPos, scrollTop, data.ref);
  const hot = hover?.nodeId === data.nodeId || (active?.nodeId === data.nodeId && active.index === data.index);
  const dx = Math.max(60, Math.abs(target.x - sourceX) / 2);
  const path = `M ${sourceX} ${sourceY} C ${sourceX + dx} ${sourceY}, ${target.x - dx} ${target.y}, ${target.x} ${target.y}`;
  const t = 0.5 + (data.index % 2 ? 1 : -1) * Math.ceil(data.index / 2) * 0.09;
  const bez = (a: number, b: number, c: number, d: number) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d;
  const lx = bez(sourceX, sourceX + dx, target.x - dx, target.x), ly = bez(sourceY, sourceY, target.y, target.y);
  const text = `source ${data.n}`;
  const w = 14 + text.length * 6.2;
  return (
    <>
      <BaseEdge id={id} path={path} interactionWidth={0} style={{ stroke: "#d97706", strokeWidth: hot ? 2.6 : 1.4, opacity: target.visible ? (hot ? 1 : 0.8) : 0.45, strokeDasharray: target.visible ? undefined : "6 5", pointerEvents: "none", transition: "stroke-width 120ms" }} />
      <g
        data-source-label={data.n}
        transform={`translate(${lx} ${ly}) scale(${hot ? 1.15 : 1})`}
        style={{ pointerEvents: "all", cursor: "pointer", transition: "transform 120ms" }}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); jump(data.nodeId, data.index); }}
        onMouseEnter={() => setHover({ nodeId: data.nodeId, index: data.index })}
        onMouseLeave={() => setHover(null)}
        className="nodrag nopan"
      >
        <title>{`Jump to source ${data.n} in the PDF (page ${data.ref.page})`}</title>
        <rect x={-w / 2} y={-LABEL_H / 2} width={w} height={LABEL_H} rx={LABEL_H / 2} fill={hot ? "#fbbf24" : "#ffffff"} stroke={hot ? "#d97706" : "#f59e0b"} strokeWidth={1} />
        <text textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={500} fill={hot ? "#ffffff" : "#b45309"} style={{ userSelect: "none" }}>{text}</text>
      </g>
    </>
  );
}
