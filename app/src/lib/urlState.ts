"use client";
import { useEffect, useRef } from "react";
import { useTreeStore } from "@/lib/store";
import { useChatStore } from "@/lib/chats";

type View = "tree" | "history" | "chats";
const isView = (v: string | null): v is View => v === "tree" || v === "history" || v === "chats";

export function useUrlState() {
  const panelOpen = useTreeStore((s) => s.panelOpen);
  const view = useTreeStore((s) => s.panelView);
  const current = useChatStore((s) => s.current);
  const chats = useChatStore((s) => s.chats);
  const applied = useRef(false);
  const wanted = useRef<string | null>(null);

  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    const q = new URLSearchParams(window.location.search);
    const p = q.get("panel");
    if (isView(p)) { useTreeStore.getState().setPanelView(p); useTreeStore.getState().setPanelOpen(true); }
    wanted.current = q.get("chat");
  }, []);

  useEffect(() => {
    const id = wanted.current;
    if (!id || !chats.length) return;
    wanted.current = null;
    if (!chats.some((c) => c.id === id)) { useChatStore.getState().showAll(); return; }
    const st = useChatStore.getState();
    st.select(id);
    setTimeout(() => st.jumpTo(id), 300);
  }, [chats]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (panelOpen) q.set("panel", view); else q.delete("panel");
    if (panelOpen && view === "chats" && current) q.set("chat", current); else q.delete("chat");
    const next = q.toString() ? `${window.location.pathname}?${q}` : window.location.pathname;
    if (next !== window.location.pathname + window.location.search) window.history.replaceState(null, "", next);
  }, [panelOpen, view, current]);
}
