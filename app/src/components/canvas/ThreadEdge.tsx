"use client";
import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";

export function ThreadEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps) {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const color = (data as { color?: string } | undefined)?.color ?? "#1f5f3f";
  return <BaseEdge id={id} path={path} style={{ stroke: color, strokeWidth: 1.6, opacity: 0.9, pointerEvents: "none" }} interactionWidth={0} />;
}
