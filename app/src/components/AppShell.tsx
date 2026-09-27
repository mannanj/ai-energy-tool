"use client";
import { ReactFlowProvider } from "@xyflow/react";
import { useTreeStore } from "@/lib/store";
import { useSession } from "@/lib/useSession";
import { TreeCanvas } from "@/components/canvas/TreeCanvas";
import { TreePanel } from "@/components/panel/TreePanel";
import { Presence } from "@/components/Presence";

export function AppShell() {
  const { status } = useSession();
  const panelOpen = useTreeStore((s) => s.panelOpen);
  const setPanelOpen = useTreeStore((s) => s.setPanelOpen);
  const hydrated = useTreeStore((s) => s.hydrated);

  if (status !== "ready" || !hydrated) {
    return <div className="flex h-screen w-screen items-center justify-center text-[13px] text-neutral-500">{status === "redirecting" ? "Redirecting…" : "Connecting to the tree…"}</div>;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <div className="relative min-w-0 flex-1">
        <ReactFlowProvider>
          <TreeCanvas />
        </ReactFlowProvider>
        <div className="absolute right-3 top-3 z-10 flex items-start gap-2">
          <Presence />
        </div>
        {!panelOpen && (
          <button
            title="Open panel"
            onClick={() => setPanelOpen(true)}
            className="absolute right-0 top-1/2 z-10 flex h-16 w-7 -translate-y-1/2 items-center justify-center rounded-l-lg border border-r-0 border-neutral-200 bg-white/95 text-neutral-700 shadow-md hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg>
          </button>
        )}
      </div>
      {panelOpen && <TreePanel />}
    </div>
  );
}
