"use client";
import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";

export function ThreadEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }: EdgeProps) {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  return <BaseEdge id={id} path={path} style={{ stroke: "#3b82f6", strokeWidth: 2, opacity: 0.9, pointerEvents: "none" }} interactionWidth={0} />;
}
