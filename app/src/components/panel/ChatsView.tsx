"use client";
import { useEffect, useState } from "react";
import { CHAT_ORIGIN, chatColor, chatLabel, useChatStore, type Chat } from "@/lib/chats";
import { Rich } from "@/components/nodes/BubbleNode";

const Avatar = ({ role }: { role: "user" | "assistant" }) => role === "user" ? (
  <span title="Resident" className="absolute -left-[34px] top-1.5 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[#4a86e8] text-white">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>
  </span>
) : (
  <span title="Helper" className="absolute -left-[34px] top-1.5 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[#e8842a] text-white">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4M9 4h6"/><circle cx="9" cy="14" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="1.3" fill="currentColor" stroke="none"/><path d="M9 18h6"/></svg>
  </span>
);

export function ChatsView() {
  const { chats, scenarios, shown, current, busy, error, reachable, showArchived } = useChatStore();
  const { load, select, showAll, rerun, runScenario, setShowArchived, archive } = useChatStore.getState();
  const [picked, setScenario] = useState("");
  const scenario = picked || scenarios[0]?.name || "";
  const opener = scenarios.find((x) => x.name === scenario)?.opener ?? "";
  useEffect(() => { load(); }, [load]);
  const c: Chat | undefined = chats.find((x) => x.id === current);

  if (!reachable) return <div className="p-3 text-[12px] text-neutral-600 dark:text-neutral-300">The chat server is not reachable at <code>{CHAT_ORIGIN}</code>. Start it with <code>cd chat &amp;&amp; bun server.ts</code>. {error && <div className="mt-1 text-red-600">{error}</div>}</div>;

  if (c) {
    return (
      <div className="relative flex h-full flex-col overflow-y-auto">
        <a href="#" onClick={(e) => { e.preventDefault(); showAll(); }} className="sticky top-2 z-10 ml-2 mr-auto rounded-lg bg-white/80 px-2 py-1 text-[12px] text-emerald-700 shadow backdrop-blur hover:bg-neutral-100 dark:bg-neutral-900/80 dark:text-emerald-400">← All chats</a>
        {shown.length > 1 && (
          <div className="flex flex-wrap gap-1 px-3 pt-1">
            {shown.map((id) => { const x = chats.find((y) => y.id === id); return x && <button key={id} onClick={() => select(id, true)} style={{ borderColor: chatColor(shown, id), color: id === current ? chatColor(shown, id) : undefined }} className={`rounded-full border px-2 py-px text-[11px] ${id === current ? "font-semibold" : "border-neutral-300 dark:border-neutral-600"}`}>{chatLabel(x)}</button>; })}
          </div>
        )}
        <div className="truncate px-3 pb-1 pt-1 text-[11px] text-neutral-500" title={`${c.source}${c.scenario ? " · " + c.scenario : ""} · ${c.status}${c.state.ended_reason ? " (" + c.state.ended_reason + ")" : ""} · tree ${c.tree_updated_at ?? "?"}`}>
          {c.source}{c.scenario && <> · <b>{c.scenario}</b></>} · {c.status}{c.state.ended_reason && ` (${c.state.ended_reason})`}{c.parent_id && <> · rerun of <a href="#" className="underline" onClick={(e) => { e.preventDefault(); select(c.parent_id!, true); }}>{c.parent_id}</a> from #{c.parent_seq}</>} · <a className="underline" href={`${CHAT_ORIGIN}/c/${c.id}`} target="_blank" rel="noopener">open</a> · <a href="#" className="underline" onClick={(e) => { e.preventDefault(); archive(c.id, !c.archived); }}>{c.archived ? "unarchive" : "archive"}</a>
        </div>
        <div className="flex flex-col gap-2 px-3 pb-6">
          {c.messages.map((m) => {
            return (
              <div key={m.seq} className={`relative ml-[34px] rounded-2xl border px-2.5 py-2 text-[13px] leading-snug shadow-sm ${m.role === "user" ? "rounded-br-sm border-[rgba(90,150,255,.35)] bg-gradient-to-br from-[rgba(90,150,255,.28)] to-[rgba(90,150,255,.10)]" : "rounded-bl-sm border-[rgba(255,150,60,.4)] bg-gradient-to-br from-[rgba(255,150,60,.30)] to-[rgba(255,150,60,.10)]"}`}>
                <Avatar role={m.role} />
                <Rich text={m.content} />
                {m.role === "assistant" && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
                    <span>{m.node_ids.length ? "square " + m.node_ids.join(", ") : "no square"}</span>
                    <button type="button" disabled={!!busy} onClick={() => rerun(c.id, m.seq)} className="rounded-md border border-neutral-300 bg-white px-1.5 py-px text-[10px] hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-600 dark:bg-neutral-800">↻ rerun from here</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {busy && <div className="fixed bottom-3 right-3 rounded-lg bg-emerald-700 px-3 py-1.5 text-[12px] text-white shadow">{busy}…</div>}
        {error && <div className="px-3 pb-3 text-[12px] text-red-600">{error}</div>}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-neutral-200 p-3 dark:border-neutral-700">
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800/60">
          <div className="text-[13px] font-medium">New chat</div>
          <label className="mt-2 block text-[11px] text-neutral-500">Resident</label>
          <select value={scenario} onChange={(e) => setScenario(e.target.value)} className="mt-0.5 w-full rounded border border-neutral-200 bg-white px-2 py-1 text-[12px] dark:border-neutral-700 dark:bg-neutral-900">
            {scenarios.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
          {opener && <div className="mt-2 rounded border border-neutral-200 bg-white px-2 py-1.5 text-[12px] text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"><span className="text-neutral-500">First message: </span>{opener}</div>}
          <button type="button" disabled={!!busy || !scenario} onClick={() => runScenario(scenario)} className="mt-2 w-full rounded bg-emerald-700 px-3 py-1.5 text-[12px] text-white hover:bg-emerald-800 disabled:opacity-40">{busy ? "Running…" : "Start chat"}</button>
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 text-[11px] uppercase tracking-wide text-neutral-500">
        Chats <span className="normal-case tracking-normal">{chats.length}</span>
        <label className="ml-auto flex items-center gap-1 normal-case tracking-normal"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> archived</label>
      </div>
      <ul className="flex-1">
        {chats.map((x) => (
          <li key={x.id} onClick={() => select(x.id)} className="cursor-pointer border-t border-neutral-200 px-3 py-2 text-[13px] hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800">
            <div className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: chatColor(shown, x.id) }} />{chatLabel(x)}</div>
            <div className="text-[11px] text-neutral-500">{[x.source + (x.parent_id ? ` of ${x.parent_id}@${x.parent_seq}` : ""), x.status, Math.floor(x.message_count / 2) + " turns", new Date(x.created_at).toLocaleString(), x.archived ? "archived" : ""].filter(Boolean).join(" · ")}</div>
          </li>
        ))}
      </ul>
      {busy && <div className="fixed bottom-3 right-3 rounded-lg bg-emerald-700 px-3 py-1.5 text-[12px] text-white shadow">{busy}…</div>}
      {error && <div className="px-3 pb-3 text-[12px] text-red-600">{error}</div>}
    </div>
  );
}
