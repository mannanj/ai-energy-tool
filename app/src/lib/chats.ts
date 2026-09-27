"use client";
import { create } from "zustand";

export const CHAT_ORIGIN = process.env.NEXT_PUBLIC_CHAT_ORIGIN || "http://localhost:8972";

export interface Review { used: "written" | "verbatim"; code_ok: boolean; covers?: number; adds_nothing?: number; tone?: number; reason?: string }
export interface ChatMessage { seq: number; role: "user" | "assistant"; content: string; node_ids: string[]; verbatim: string | null; review: Review | null }
export interface Chat {
  id: string; title: string; scenario: string | null; source: string; status: "open" | "done"; created_at: string; message_count: number; archived: boolean;
  parent_id: string | null; parent_seq: number | null; tree_updated_at: string | null;
  state: { ended_reason?: string; path?: string[] }; messages: ChatMessage[];
}
export interface Scenario { name: string; opener: string }

export const CHAT_COLORS = ["#1f5f3f", "#8a4b9c", "#b9651a", "#1f4f8a", "#a33", "#3a7d7d"];

interface State {
  inspectOn: boolean;
  chats: Chat[];
  visits: Record<string, number>;
  holes: string[];
  scenarios: Scenario[];
  shown: string[];
  current: string | null;
  showArchived: boolean;
  busy: string | null;
  error: string | null;
  reachable: boolean;

  setInspect: (v: boolean) => void;
  load: () => Promise<void>;
  select: (id: string | null, keep?: boolean) => void;
  showAll: () => void;
  setShowArchived: (v: boolean) => void;
  rerun: (id: string, seq: number) => Promise<void>;
  runScenario: (name: string) => Promise<void>;
  archive: (id: string, archived: boolean) => Promise<void>;
}

const jfetch = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const r = await fetch(CHAT_ORIGIN + path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
};

export const useChatStore = create<State>((set, get) => ({
  inspectOn: false, chats: [], visits: {}, holes: [], scenarios: [], shown: [], current: null, showArchived: false, busy: null, error: null, reachable: true,

  setInspect: (v) => { set({ inspectOn: v }); if (v) get().load(); },
  load: async () => {
    try {
      const [d, sc] = await Promise.all([
        jfetch<{ chats: Chat[]; visits: Record<string, number>; holes: string[] }>("/api/admin/chats" + (get().showArchived ? "?archived=1" : "")),
        get().scenarios.length ? Promise.resolve(get().scenarios) : jfetch<Scenario[]>("/api/admin/scenarios"),
      ]);
      const ids = new Set(d.chats.map((c) => c.id));
      const shown = get().shown.filter((id) => ids.has(id));
      set({ chats: d.chats, visits: d.visits, holes: d.holes, scenarios: sc, reachable: true, error: null, shown: get().current ? shown : d.chats.map((c) => c.id) });
    } catch (e) { set({ reachable: false, error: (e as Error).message }); }
  },
  select: (id, keep = false) => {
    if (!id) return get().showAll();
    const shown = keep ? [...get().shown] : [];
    if (!shown.includes(id)) shown.push(id);
    set({ current: id, shown });
  },
  showAll: () => set({ current: null, shown: get().chats.map((c) => c.id) }),
  setShowArchived: (v) => { set({ showArchived: v }); get().load(); },
  rerun: async (id, seq) => {
    set({ busy: `rerun ${id} from #${seq}`, error: null });
    try { const j = await jfetch<{ id: string }>(`/api/chats/${id}/rerun`, { method: "POST", body: JSON.stringify({ seq }) }); await get().load(); get().select(j.id, true); }
    catch (e) { set({ error: (e as Error).message }); }
    finally { set({ busy: null }); }
  },
  runScenario: async (name) => {
    set({ busy: `running ${name}`, error: null });
    try { const j = await jfetch<{ id: string }>("/api/admin/new", { method: "POST", body: JSON.stringify({ scenario: name }) }); await get().load(); get().select(j.id); }
    catch (e) { set({ error: (e as Error).message }); }
    finally { set({ busy: null }); }
  },
  archive: async (id, archived) => { await jfetch("/api/admin/archive", { method: "POST", body: JSON.stringify({ id, archived }) }); await get().load(); },
}));

export const chatColor = (shown: string[], id: string) => CHAT_COLORS[Math.max(0, shown.indexOf(id)) % CHAT_COLORS.length];
export const chatLabel = (c: Chat) => (c.parent_id ? "rerun " : "") + (c.scenario || c.title || c.id).slice(0, 40);
