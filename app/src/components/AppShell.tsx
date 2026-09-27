"use client";
import { useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { attachStorageSync, useTreeStore } from "@/lib/store";
import { TreeCanvas } from "@/components/canvas/TreeCanvas";
import { TreePanel } from "@/components/panel/TreePanel";

export function AppShell() {
  const panelOpen = useTreeStore((s) => s.panelOpen);
  const setPanelOpen = useTreeStore((s) => s.setPanelOpen);
  const hydrated = useTreeStore((s) => s.hydrated);
  useEffect(() => attachStorageSync(), []);
  if (!hydrated) return <div className="h-screen w-screen" />;

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <div className="relative min-w-0 flex-1">
        <ReactFlowProvider>
          <TreeCanvas />
        </ReactFlowProvider>
        {!panelOpen && (
          <button
            title="Open tree panel"
            onClick={() => setPanelOpen(true)}
            className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 bg-white/95 text-neutral-700 shadow-md hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/><path d="M9 6h12M9 12h12M9 18h12"/></svg>
          </button>
        )}
      </div>
      {panelOpen && <TreePanel />}
    </div>
  );
}
