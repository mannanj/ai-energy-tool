"use client";
import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { useChatStore, type Review } from "@/lib/chats";

export type BubbleData = { chatId: string; seq: number; role: "user" | "assistant"; color: string; text: string; nodeIds: string[]; review: Review | null; label: string | null };
export type BubbleNodeType = Node<BubbleData, "bubble">;

const Human = () => (
  <span title="Resident" className="absolute -left-[30px] top-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#4a86e8] text-white">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>
  </span>
);
const Robot = () => (
  <span title="Helper" className="absolute -left-[30px] top-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#e8842a] text-white">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4M9 4h6"/><circle cx="9" cy="14" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="1.3" fill="currentColor" stroke="none"/><path d="M9 18h6"/></svg>
  </span>
);

export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) => p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i} className="whitespace-pre-wrap">{p}</span>)}</>;
}

export const ReviewPill = ({ r }: { r: Review | null }) => {
  if (!r) return null;
  const ok = r.used === "written";
  const f = (x?: number) => (x == null ? "–" : x.toFixed(2));
  const title = ok ? `DeepSeek's wording kept. Jev: covers ${f(r.covers)}, adds nothing ${f(r.adds_nothing)}, asks the same ${f(r.tone)}` : `Square text sent verbatim: ${r.reason ?? ""}`;
  return <span title={title} className={`inline-block rounded-full border px-1.5 text-[10px] ${ok ? "border-emerald-600 text-emerald-700 dark:text-emerald-400" : "border-red-500 text-red-600 dark:text-red-400"}`}>{ok ? "written" : "verbatim"}</span>;
};

export const BubbleNode = memo(function BubbleNode({ data }: NodeProps<BubbleNodeType>) {
  const rerun = useChatStore((s) => s.rerun);
  const busy = useChatStore((s) => s.busy);
  const select = useChatStore((s) => s.select);
  const user = data.role === "user";
  return (
    <div style={{ width: 300 }} className="flex flex-col gap-1 text-[11px] leading-snug" onClick={() => select(data.chatId, true)}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: "none", left: 44 }} />
      {data.label && <span className="ml-[30px] pl-2 text-[9px] font-semibold" style={{ color: data.color }}>Chat: {data.label}</span>}
      <div title={user ? "Resident" : "square " + data.nodeIds.join(", ")}
        className={`nowheel relative ml-[30px] overflow-auto rounded-2xl border px-2 py-1.5 text-neutral-900 shadow-sm backdrop-blur-[2px] dark:text-neutral-100 ${user
          ? "max-h-[6.5em] rounded-br-sm border-[rgba(90,150,255,.35)] bg-gradient-to-br from-[rgba(90,150,255,.28)] to-[rgba(90,150,255,.12)]"
          : "max-h-[9em] rounded-bl-sm border-[rgba(255,150,60,.4)] bg-gradient-to-br from-[rgba(255,150,60,.30)] to-[rgba(255,150,60,.12)]"}`}>
        {user ? <Human /> : <Robot />}<Rich text={data.text} />
      </div>
      {!user && (
        <div className="ml-[30px] pl-1">
          <button type="button" disabled={!!busy} onClick={(e) => { e.stopPropagation(); rerun(data.chatId, data.seq); }} title="Replay the resident's messages up to this reply through the current tree, then let the resident continue. Appears as a new column beside this one."
            className="nodrag rounded-md border border-neutral-300 bg-white/90 px-1.5 py-px text-[10px] hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-600 dark:bg-neutral-800/90 dark:hover:bg-neutral-700">↻ rerun from here</button>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: "none", left: 44 }} />
    </div>
  );
});
