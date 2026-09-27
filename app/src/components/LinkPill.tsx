"use client";
import { useEffect, useRef, useState } from "react";
import { shortLabel, toHref } from "@/lib/links";

/**
 * Link pill (Event Every style): label, hover shows the full URL,
 * copy icon on the right, then a triple-dot menu with Share / Open / Remove.
 */
export function LinkPill({ url, onRemove }: { url: string; onRemove?: () => void }) {
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const href = toHref(url);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setMenu(false); };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [menu]);

  const copy = async (e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    try { await navigator.clipboard.writeText(href); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch {}
    setMenu(false);
  };

  return (
    <span
      ref={ref}
      className="nodrag nopan relative inline-flex max-w-full items-stretch rounded-full border border-sky-300 bg-sky-50 text-[12px] leading-none text-sky-800 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-200"
      title={href}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="truncate px-2.5 py-1 hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {shortLabel(url)}
      </a>
      <button
        type="button"
        aria-label="Copy link"
        title={copied ? "Copied" : "Copy link"}
        onClick={copy}
        className="border-l border-sky-200 px-1.5 hover:bg-sky-100 dark:border-sky-800 dark:hover:bg-sky-900"
      >
        {copied ? "✓" : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        )}
      </button>
      <button
        type="button"
        aria-label="More actions"
        title="More"
        onClick={(e) => { e.stopPropagation(); setMenu((m) => !m); }}
        className="rounded-r-full border-l border-sky-200 px-1.5 hover:bg-sky-100 dark:border-sky-800 dark:hover:bg-sky-900"
      >
        ⋯
      </button>
      {menu && (
        <span className="absolute right-0 top-full z-50 mt-1 flex min-w-40 flex-col overflow-hidden rounded-md border border-neutral-200 bg-white text-[12px] text-neutral-800 shadow-lg dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100">
          <button className="px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={copy}>Share (copy link)</button>
          <button className="px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={() => { window.open(href, "_blank", "noopener"); setMenu(false); }}>Open in new tab</button>
          {onRemove && (
            <button className="px-3 py-1.5 text-left text-red-600 hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={() => { onRemove(); setMenu(false); }}>Remove from text</button>
          )}
        </span>
      )}
    </span>
  );
}
