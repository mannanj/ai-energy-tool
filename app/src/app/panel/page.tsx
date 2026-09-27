"use client";
import { useEffect } from "react";
import { attachStorageSync, useTreeStore } from "@/lib/store";
import { TreePanel } from "@/components/panel/TreePanel";

/** Pop-out window: the panel alone, full width. Edits sync to the main window through localStorage. */
export default function PanelPage() {
  const hydrated = useTreeStore((s) => s.hydrated);
  useEffect(() => attachStorageSync(), []);
  if (!hydrated) return null;
  return <div className="h-screen w-screen"><TreePanel popout /></div>;
}
