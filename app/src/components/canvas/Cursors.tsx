"use client";
import { ViewportPortal, useViewport } from "@xyflow/react";
import { useTreeStore } from "@/lib/store";

/** Other people's cursors, drawn in canvas coordinates so they stay put when you pan or zoom. */
export function Cursors() {
  const peers = useTreeStore((s) => s.peers);
  const { zoom } = useViewport();
  const inv = 1 / zoom;
  return (
    <ViewportPortal>
      {peers.filter((p) => p.cursor).map((p) => (
        <div
          key={p.clientId}
          style={{ transform: `translate(${p.cursor!.x}px, ${p.cursor!.y}px) scale(${inv})`, transformOrigin: "0 0", transition: "transform 60ms linear" }}
          className="pointer-events-none absolute left-0 top-0 z-50"
        >
          <svg width="18" height="22" viewBox="0 0 18 22" style={{ display: "block" }}>
            <path d="M1 1 L1 17 L5.5 12.5 L8.5 20 L11.5 18.8 L8.5 11.5 L15 11.5 Z" fill={p.user.color} stroke="white" strokeWidth="1.2" />
          </svg>
          <span style={{ background: p.user.color }} className="ml-3 -mt-1 inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium text-white shadow">
            {p.user.name}
          </span>
        </div>
      ))}
    </ViewportPortal>
  );
}
