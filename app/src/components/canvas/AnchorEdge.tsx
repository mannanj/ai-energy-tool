"use client";
import { BaseEdge, getStraightPath, type EdgeProps } from "@xyflow/react";

export function AnchorEdge({ id, sourceX, sourceY, targetX, targetY }: EdgeProps) {
  const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  return <BaseEdge id={id} path={path} style={{ stroke: "#22c55e", strokeWidth: 1.4, opacity: 0.9, pointerEvents: "none" }} interactionWidth={0} />;
}
