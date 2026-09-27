"use client";
import { memo, useCallback, useEffect, useRef } from "react";
import { Handle, NodeResizer, Position, type NodeProps, type Node } from "@xyflow/react";
import { useLock, useTreeStore } from "@/lib/store";
import { LockNotice } from "@/components/LockNotice";
import { ROOT_PLACEHOLDER } from "@/lib/seed";
import { LinkPills } from "@/components/LinkPills";

export type SquareData = { text: string; isRoot: boolean; number: string; autoFocus?: boolean };
export type SquareNodeType = Node<SquareData, "square">;

/**
 * The only shape on the canvas. Click inside to type. Drag by the grip bar or the border ring.
 * Resize with the corner/edge handles (visible when selected). Links inside become pills at the bottom.
 */
export const SquareNode = memo(function SquareNode({ id, data, selected, width, height }: NodeProps<SquareNodeType>) {
  const updateText = useTreeStore((s) => s.updateNodeText);
  const resizeNode = useTreeStore((s) => s.resizeNode);
  const addChild = useTreeStore((s) => s.addChild);
  const clearFocus = useTreeStore((s) => s.clearFocus);
  const acquireLock = useTreeStore((s) => s.acquireLock);
  const releaseLock = useTreeStore((s) => s.releaseLock);
  const editor = useTreeStore((s) => s.peers.find((p) => p.editingNodeId === id)?.user ?? null);
  const { lockedBy } = useLock(id);
  const ref = useRef<HTMLTextAreaElement>(null);

  // if someone else takes the square while we are typing in it, drop focus so the gray state shows
  useEffect(() => {
    if (lockedBy && document.activeElement === ref.current) ref.current?.blur();
  }, [lockedBy]);

  useEffect(() => {
    if (data.autoFocus) { ref.current?.focus(); clearFocus(); }
  }, [data.autoFocus, clearFocus]);

  // Tab while typing in a square → new connected child below (and focus moves to it)
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      // leave this field first so fast keystrokes cannot land here while the child mounts
      (e.target as HTMLTextAreaElement).blur();
      addChild(id);
    }
    else if (e.key === "Escape") (e.target as HTMLTextAreaElement).blur();
  }, [addChild, id]);

  const onChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => updateText(id, e.target.value), [id, updateText]);
  const empty = !data.text.trim();
  const required = data.isRoot && empty;

  return (
    <div
      style={{ width: width ?? 240, height: height ?? 120, boxShadow: editor ? `0 0 0 3px ${editor.color}` : undefined }}
      className={`group relative flex flex-col rounded-md border-2 bg-white shadow-sm dark:bg-neutral-900 ${
        required ? "border-red-400" : data.isRoot ? "border-amber-500" : selected ? "border-sky-500" : "border-neutral-300 dark:border-neutral-600"
      } ${lockedBy ? "bg-neutral-100 dark:bg-neutral-800" : ""}`}
    >
      {editor && (
        <span style={{ background: editor.color }} className="absolute -top-5 right-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-white">{editor.name}</span>
      )}
      <NodeResizer
        isVisible={!!selected}
        minWidth={120}
        minHeight={60}
        lineClassName="!border-sky-400"
        handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-sky-500 !bg-white"
        onResizeEnd={(_, p) => resizeNode(id, p.width, p.height)}
      />
      <Handle type="target" position={Position.Top} className="!h-3 !w-3 !bg-neutral-400" />
      <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !bg-sky-500" />

      {/* grip bar: drag here */}
      <div className="flex h-5 shrink-0 cursor-grab items-center justify-between rounded-t px-2 text-[10px] text-neutral-400 active:cursor-grabbing">
        <span>{data.isRoot ? "Top level question" : `#${data.number}`}</span>
        <span className="tracking-widest">⋮⋮⋮</span>
      </div>

      {lockedBy && <LockNotice lock={lockedBy} className="px-2" />}
      <textarea
        ref={ref}
        value={data.text}
        disabled={!!lockedBy}
        onFocus={() => { if (!acquireLock(id)) ref.current?.blur(); }}
        onBlur={() => releaseLock(id)}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={data.isRoot ? ROOT_PLACEHOLDER : "Type an answer, question, or paste a link…"}
        className="nodrag nowheel min-h-0 flex-1 resize-none bg-transparent px-2 pb-1 text-[14px] leading-snug outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:text-neutral-400"
        spellCheck={false}
      />
      <LinkPills text={data.text} onTextChange={(t) => updateText(id, t)} className="px-2 pb-2" />
      {required && <span className="absolute -bottom-5 left-0 text-[11px] text-red-500">Required</span>}
    </div>
  );
});
