"use client";
import { extractLinks } from "@/lib/links";
import { LinkPill } from "./LinkPill";

export function LinkPills({ text, onTextChange, className = "" }: { text: string; onTextChange?: (t: string) => void; className?: string }) {
  const links = extractLinks(text);
  if (!links.length) return null;
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {links.map((l, i) => (
        <LinkPill
          key={`${l.start}-${i}`}
          url={l.url}
          onRemove={onTextChange ? () => onTextChange((text.slice(0, l.start) + text.slice(l.end)).replace(/\s{2,}/g, " ")) : undefined}
        />
      ))}
    </div>
  );
}
