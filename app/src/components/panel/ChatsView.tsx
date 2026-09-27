"use client";
import { useEffect, useState } from "react";
import { CHAT_ORIGIN, chatColor, chatLabel, useChatStore, type Chat } from "@/lib/chats";
import { Rich } from "@/components/nodes/BubbleNode";

const Avatar = ({ role, n }: { role: "user" | "assistant"; n: number }) => role === "user" ? (
  <>
  <span title="Resident" className="absolute -left-[34px] top-1.5 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[#4a86e8] text-white">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>
  </span>
  <span className="pointer-events-none absolute -left-[34px] top-[34px] w-[26px] text-center text-[10px] font-semibold leading-none text-[#4a86e8]">#{n}</span>
  </>
) : (
  <>
  <span title="Helper" className="absolute -left-[34px] top-1.5 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[#e8842a] text-white">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4M9 4h6"/><circle cx="9" cy="14" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="1.3" fill="currentColor" stroke="none"/><path d="M9 18h6"/></svg>
  </span>
  <span className="pointer-events-none absolute -left-[34px] top-[34px] w-[26px] text-center text-[10px] font-semibold leading-none text-[#e8842a]">#{n}</span>
  </>
);

export function ChatsView() {
  const { chats, shown, current, busy, error, reachable, hover } = useChatStore();
  const { load, select, showAll, rerun, send, archive, setHover, jumpTo } = useChatStore.getState();
  const [draft, setDraft] = useState("");
  const [reply, setReply] = useState("");
  const start = () => { const t = draft.trim(); if (!t || busy) return; setDraft(""); send(null, t); };
  const prompts = useChatStore((s) => s.prompts);
  const activeId = useChatStore((s) => s.activePrompt);
  const { loadPrompts, savePrompt, activatePrompt, renamePrompt } = useChatStore.getState();
  const [promptOpen, setPromptOpen] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [promptText, setPromptText] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  useEffect(() => { if (promptOpen && !prompts.length) loadPrompts(); }, [promptOpen, prompts.length, loadPrompts]);
  const picked = prompts.find((x) => x.id === (pickedId ?? activeId)) ?? prompts[0];
  const text = promptText ?? picked?.text ?? "";
  const dirty = !!picked && text !== picked.text;
  const answer = (id: string) => { const t = reply.trim(); if (!t || busy) return; setReply(""); send(id, t); };
  useEffect(() => { load(); }, [load]);
  const c: Chat | undefined = chats.find((x) => x.id === current);

  if (!reachable) return <div className="p-3 text-[12px] text-neutral-600 dark:text-neutral-300">The chat backend did not answer{CHAT_ORIGIN ? <> at <code>{CHAT_ORIGIN}</code></> : ""}. {error && <div className="mt-1 text-red-600">{error}</div>}</div>;

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
          {c.messages.map((m, i) => {
            const n = c.messages.slice(0, i + 1).filter((x) => x.role === m.role).length;
            return (
              <div key={m.seq} onMouseEnter={() => setHover({ chatId: c.id, seq: m.seq })} onMouseLeave={() => setHover(null)} onClick={() => jumpTo(c.id, m.seq)} style={{ transform: hover && hover.chatId === c.id && hover.seq === m.seq ? "scale(1.02)" : undefined, transition: "transform 120ms" }} className={`relative ml-[34px] cursor-pointer rounded-2xl border px-2.5 py-2 text-[13px] leading-snug shadow-sm ${hover && hover.chatId === c.id && hover.seq === m.seq ? "ring-2 ring-sky-400/50" : ""} ${m.role === "user" ? "rounded-br-sm border-[rgba(90,150,255,.35)] bg-gradient-to-br from-[rgba(90,150,255,.28)] to-[rgba(90,150,255,.10)]" : "rounded-bl-sm border-[rgba(255,150,60,.4)] bg-gradient-to-br from-[rgba(255,150,60,.30)] to-[rgba(255,150,60,.10)]"}`}>
                <Avatar role={m.role} n={n} />
                <Rich text={m.content} />
                {m.role === "assistant" && m.trace && (
                  <div className="mt-1.5 rounded bg-black/5 px-2 py-1 font-mono text-[10px] leading-relaxed text-neutral-600 dark:bg-white/5 dark:text-neutral-300">
                    {m.trace.tools.map((t, i) => <div key={i}><span className={t.tool === "math" ? "text-rose-600 dark:text-rose-400" : "text-sky-700 dark:text-sky-400"}>{t.tool}</span> {t.result}{t.decided ? " ✓" : ""} <span className="text-neutral-400">{t.ms}ms</span></div>)}
                    {m.trace.read && <div><span className="text-sky-700 dark:text-sky-400">read</span> {m.trace.read.skipped ? "skipped, tools decided" : m.trace.read.reader} <span className="text-neutral-400">{m.trace.read.ms}ms</span></div>}
                    {m.trace.write && <div><span className="text-sky-700 dark:text-sky-400">write</span> {m.trace.write.attempts} draft{m.trace.write.attempts === 1 ? "" : "s"}, used {m.trace.write.used} <span className="text-neutral-400">{m.trace.write.ms}ms</span></div>}
                    <div><span className="text-neutral-400">total {m.trace.total_ms}ms</span></div>
                  </div>
                )}
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
        {c.status === "open" && (
          <div className="sticky bottom-0 mt-auto border-t border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); answer(c.id); } }} rows={2} placeholder="Your reply" className="w-full resize-y rounded border border-neutral-200 bg-white px-2 py-1.5 text-[12px] outline-none focus:border-sky-400 dark:border-neutral-700 dark:bg-neutral-900" />
            <button type="button" disabled={!!busy || !reply.trim()} onClick={() => answer(c.id)} className="mt-1.5 rounded bg-emerald-700 px-3 py-1 text-[12px] text-white hover:bg-emerald-800 disabled:opacity-40">{busy ? "Sending…" : "Send"}</button>
          </div>
        )}
        {busy && <div className="fixed bottom-3 right-3 rounded-lg bg-emerald-700 px-3 py-1.5 text-[12px] text-white shadow">{busy}…</div>}
        {error && <div className="px-3 pb-3 text-[12px] text-red-600">{error}</div>}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="p-3">
        <button type="button" onClick={() => setPromptOpen(!promptOpen)} className="flex items-center gap-1 text-[12px] text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">
          <span className={`inline-block transition-transform ${promptOpen ? "rotate-90" : ""}`}>▸</span> System prompt{picked && <span className="text-neutral-400"> · {picked.title}</span>}
        </button>
        {promptOpen && picked && (
          <div className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2 dark:border-neutral-700 dark:bg-neutral-800/60">
            <select value={picked.id} onChange={(e) => { setPickedId(e.target.value); setPromptText(null); setTitleDraft(null); }} className="w-full rounded border border-neutral-200 bg-white px-2 py-1 text-[12px] dark:border-neutral-700 dark:bg-neutral-900">
              {prompts.map((x) => <option key={x.id} value={x.id}>{x.title}{x.id === activeId ? " (in use)" : ""} · {new Date(x.created_at).toLocaleString()}</option>)}
            </select>
            <input value={titleDraft ?? picked.title} onChange={(e) => setTitleDraft(e.target.value)} onBlur={() => { if (titleDraft != null && titleDraft.trim() && titleDraft !== picked.title) renamePrompt(picked.id, titleDraft); setTitleDraft(null); }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} title="Title of this version, click to edit" className="mt-1.5 w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-[12px] font-medium hover:border-neutral-200 focus:border-sky-400 focus:bg-white focus:outline-none dark:hover:border-neutral-700 dark:focus:bg-neutral-900" />
            <textarea value={text} onChange={(e) => setPromptText(e.target.value)} rows={14} spellCheck={false} className="mt-1 w-full resize-y rounded border border-neutral-200 bg-white px-2 py-1.5 font-mono text-[11px] leading-snug outline-none focus:border-sky-400 dark:border-neutral-700 dark:bg-neutral-900" />
            <div className="mt-1.5 flex items-center gap-2">
              <button type="button" disabled={!dirty || !!busy} onClick={async () => { await savePrompt(text); setPromptText(null); setPickedId(null); }} className="rounded bg-emerald-700 px-3 py-1 text-[12px] text-white hover:bg-emerald-800 disabled:opacity-40">Save as new version</button>
              {picked.id !== activeId && !dirty && <button type="button" disabled={!!busy} onClick={() => activatePrompt(picked.id)} className="rounded border border-neutral-300 px-3 py-1 text-[12px] hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800">Use this version</button>}
              {dirty && <button type="button" onClick={() => setPromptText(null)} className="text-[12px] text-neutral-500 underline">discard</button>}
            </div>
          </div>
        )}
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); start(); } }} rows={3} placeholder="Start a new chat: write your first message here" className="mt-3 w-full resize-y rounded border border-neutral-200 bg-white px-2 py-1.5 text-[12px] outline-none focus:border-sky-400 dark:border-neutral-700 dark:bg-neutral-900" />
        <button type="button" disabled={!!busy || !draft.trim()} onClick={start} className="mt-2 rounded bg-emerald-700 px-3 py-1.5 text-[12px] text-white hover:bg-emerald-800 disabled:opacity-40">{busy ? "Starting…" : "Start new chat"}</button>
      </div>
      <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-neutral-500">History ({chats.length})</div>
      <ul className="flex-1">
        {chats.map((x) => (
          <li key={x.id} onMouseEnter={() => setHover({ chatId: x.id })} onMouseLeave={() => setHover(null)} onClick={() => { select(x.id); jumpTo(x.id); }} style={{ transform: hover?.chatId === x.id ? "scale(1.02)" : undefined, transition: "transform 120ms" }} className={`cursor-pointer rounded-lg px-3 py-2 text-[13px] ${hover?.chatId === x.id ? "ring-2 ring-sky-400/50" : ""}`}>
            <div className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: chatColor(shown, x.id) }} />{chatLabel(x)}</div>
            <div className="text-[11px] text-neutral-500">{[x.source + (x.parent_id ? ` of ${x.parent_id}@${x.parent_seq}` : ""), x.status, Math.floor(x.message_count / 2) + " turns", new Date(x.created_at).toLocaleString()].filter(Boolean).join(" · ")}</div>
          </li>
        ))}
      </ul>
      {busy && <div className="fixed bottom-3 right-3 rounded-lg bg-emerald-700 px-3 py-1.5 text-[12px] text-white shadow">{busy}…</div>}
      {error && <div className="px-3 pb-3 text-[12px] text-red-600">{error}</div>}
    </div>
  );
}
