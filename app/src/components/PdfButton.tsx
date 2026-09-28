"use client";
import { useRef, useState } from "react";
import { useTreeStore } from "@/lib/store";

export function PdfButton() {
  const treeId = useTreeStore((s) => s.treeId);
  const hasPdf = useTreeStore((s) => !!s.trees.find((t) => t.id === s.treeId)?.pdfKey);
  const pdfOpen = useTreeStore((s) => s.pdfOpen);
  const setPdfOpen = useTreeStore((s) => s.setPdfOpen);
  const uploadPdf = useTreeStore((s) => s.uploadPdf);
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onPick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    await uploadPdf(f);
    setBusy(false);
  };

  const base = "flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-medium shadow-md";
  if (!hasPdf) {
    return (
      <>
        <input ref={file} type="file" accept="application/pdf" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
        <button type="button" disabled={busy} title={`Attach the source PDF for this tree (${treeId})`} onClick={() => file.current?.click()}
          className={`${base} border-neutral-200 bg-white/95 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-neutral-300 dark:hover:bg-neutral-800`}>
          {busy ? "uploading…" : "add PDF"}
        </button>
      </>
    );
  }
  return (
    <button type="button" title={pdfOpen ? "Hide the source PDF" : "Show the source PDF on the canvas with lines to the squares it sourced"} onClick={() => setPdfOpen(!pdfOpen)}
      className={`${base} ${pdfOpen ? "border-amber-500 bg-amber-500 text-white" : "border-neutral-200 bg-white/95 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-neutral-200 dark:hover:bg-neutral-800"}`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></svg>
      PDF
    </button>
  );
}
