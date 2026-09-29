"use client";

export interface Shared {
  current: string | null;
  shown: string[];
  reveal: { chatId: string; seq: number | null; n: number } | null;
  hover: { chatId: string; seq?: number } | null;
  focus: { ids: string[]; n: number } | null;
}

const CHANNEL = "aet-chat-selection";
const windowId = Math.random().toString(36).slice(2);

export function openWindowsChannel(apply: (patch: Partial<Shared>) => void): (patch: Partial<Shared>) => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (e: MessageEvent<{ from: string; patch: Partial<Shared> }>) => {
    if (e.data?.from === windowId) return;
    apply(e.data.patch);
  };
  return (patch) => channel.postMessage({ from: windowId, patch });
}

export function scrollWithin(el: HTMLElement | null, container: HTMLElement | null, margin = 12): void {
  if (!el || !container) return;
  const top = el.offsetTop - container.offsetTop;
  const bottom = top + el.offsetHeight;
  if (top - margin < container.scrollTop) container.scrollTop = Math.max(0, top - margin);
  else if (bottom + margin > container.scrollTop + container.clientHeight) container.scrollTop = bottom + margin - container.clientHeight;
}
