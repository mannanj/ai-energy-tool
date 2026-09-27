"use client";
import { useTreeStore } from "@/lib/store";
import { useSession } from "@/lib/useSession";
import { TreePanel } from "@/components/panel/TreePanel";

/** Pop-out window: the panel alone, full width, connected to the same room. */
export default function PanelPage() {
  const { status } = useSession();
  const hydrated = useTreeStore((s) => s.hydrated);
  if (status !== "ready" || !hydrated) return <div className="p-4 text-[13px] text-neutral-500">Connecting…</div>;
  return <div className="h-screen w-screen"><TreePanel popout /></div>;
}
