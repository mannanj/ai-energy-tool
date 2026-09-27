"use client";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { useTreeStore } from "@/lib/store";

/** Arrow parent → child. When selected, a small input lets you label it (e.g. Yes / No). */
export function LabeledEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, label, selected, markerEnd }: EdgeProps) {
  const setEdgeLabel = useTreeStore((s) => s.setEdgeLabel);
  const [path, lx, ly] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 12 });
  const text = typeof label === "string" ? label : "";
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke: selected ? "#0ea5e9" : "#737373", strokeWidth: 1.6 }} />
      <EdgeLabelRenderer>
        <div
          style={{ transform: `translate(-50%, -50%) translate(${lx}px,${ly}px)` }}
          className="nodrag nopan pointer-events-auto absolute"
        >
          {selected ? (
            <input
              autoFocus
              defaultValue={text}
              placeholder="label"
              onBlur={(e) => setEdgeLabel(id, e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              className="w-20 rounded border border-sky-400 bg-white px-1 text-[11px] outline-none dark:bg-neutral-900"
            />
          ) : text ? (
            <span className="rounded bg-white px-1.5 py-0.5 text-[11px] text-neutral-700 shadow dark:bg-neutral-800 dark:text-neutral-200">{text}</span>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
