"use client";
import { BaseEdge, getStraightPath, type EdgeProps } from "@xyflow/react";

export function AnchorEdge({ id, sourceX, sourceY, targetX, targetY }: EdgeProps) {
  const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  return <BaseEdge id={id} path={path} style={{ stroke: "#e11d48", strokeWidth: 1.4, strokeDasharray: "4 3", opacity: 0.85, pointerEvents: "none" }} interactionWidth={0} />;
}
