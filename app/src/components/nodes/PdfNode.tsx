"use client";
import { memo, useEffect, useRef, useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useSources, useTreeStore } from "@/lib/store";
import { openPdf } from "@/lib/pdf";
import { layoutPages, PAGE_GAP, PDF_HEADER, PDF_W, type PdfLayout } from "@/lib/sources";

export type PdfData = { url: string };
export type PdfNodeType = Node<PdfData, "pdf">;

const RENDER_SCALE = 2;

function Page({ pdf, index, layout }: { pdf: PDFDocumentProxy; index: number; layout: PdfLayout }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pg = layout.pages[index];
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const page = await pdf.getPage(index + 1);
      if (cancelled || !canvas.current) return;
      const viewport = page.getViewport({ scale: pg.scale * RENDER_SCALE });
      const c = canvas.current;
      c.width = Math.round(viewport.width); c.height = Math.round(viewport.height);
      await page.render({ canvas: c, viewport }).promise;
    })();
    return () => { cancelled = true; };
  }, [pdf, index, pg.scale]);
  return <canvas ref={canvas} style={{ width: pg.w, height: pg.h, display: "block" }} className="bg-white" />;
}

function Highlights({ page, layout }: { page: number; layout: PdfLayout }) {
  const sources = useSources();
  const hover = useTreeStore((s) => s.hoverSource);
  const active = useTreeStore((s) => s.activeSource);
  const setHover = useTreeStore((s) => s.setHoverSource);
  const jump = useTreeStore((s) => s.jumpToSource);
  const pg = layout.pages[page - 1];
  return (
    <>
      {sources.filter((s) => s.ref.page === page).map((s) => {
        const hot = hover?.nodeId === s.nodeId;
        const on = active?.nodeId === s.nodeId && active.index === s.index;
        return (
          <div
            key={s.key}
            title={`source ${s.n}: hover to light up the square this came from, click to jump`}
            onMouseEnter={() => setHover({ nodeId: s.nodeId, index: s.index })}
            onMouseLeave={() => setHover(null)}
            onClick={(e) => { e.stopPropagation(); jump(s.nodeId, s.index); }}
            style={{ left: s.ref.x * pg.scale, top: s.ref.y * pg.scale, width: s.ref.w * pg.scale, height: s.ref.h * pg.scale }}
            className={`absolute cursor-pointer rounded-sm border-b-2 transition-all duration-150 ${on ? "z-10 border-amber-600 bg-amber-300/70 shadow-[0_0_0_3px_rgba(245,158,11,.6)] animate-pulse" : hot ? "border-amber-600 bg-amber-300/60 shadow-[0_0_0_2px_rgba(245,158,11,.5)]" : "border-amber-500 bg-amber-200/45 hover:bg-amber-300/60"}`}
          >
            <span className="absolute -left-1 -top-2 rounded bg-amber-500 px-1 text-[9px] font-semibold leading-tight text-white">{s.n}</span>
          </div>
        );
      })}
    </>
  );
}

export const PdfNode = memo(function PdfNode({ data }: NodeProps<PdfNodeType>) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const layout = useTreeStore((s) => s.pdfLayout);
  const setLayout = useTreeStore((s) => s.setPdfLayout);
  const setScrollTop = useTreeStore((s) => s.setPdfScrollTop);
  const scrollTop = useTreeStore((s) => s.pdfScrollTop);
  const scrollTo = useTreeStore((s) => s.pdfScrollTo);
  const clearScrollTo = useTreeStore((s) => s.clearPdfScrollTo);
  const setPdfOpen = useTreeStore((s) => s.setPdfOpen);
  const box = useRef<HTMLDivElement>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    openPdf(data.url).then(async (doc) => {
      if (cancelled) return;
      const sizes = [];
      for (let i = 1; i <= doc.numPages; i++) { const v = (await doc.getPage(i)).getViewport({ scale: 1 }); sizes.push({ w: v.width, h: v.height }); }
      if (cancelled) return;
      setLayout(layoutPages(sizes));
      setPdf(doc);
    }).catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [data.url, setLayout]);

  useEffect(() => {
    if (scrollTo == null || !box.current) return;
    box.current.scrollTo({ top: scrollTo, behavior: "smooth" });
    clearScrollTo();
  }, [scrollTo, clearScrollTo]);

  const onScroll = () => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => { raf.current = null; if (box.current) setScrollTop(box.current.scrollTop); });
  };
  const pageAt = (top: number) => (layout ? Math.max(0, layout.pages.findIndex((p) => top < p.top + p.h)) : 0);
  const first = layout ? pageAt(scrollTop) : 0;
  const last = layout ? pageAt(scrollTop + layout.viewH - 1) : 0;
  const go = (delta: number) => { if (!layout || !box.current) return; const i = Math.min(layout.pages.length - 1, Math.max(0, first + delta)); box.current.scrollTo({ top: layout.pages[i].top, behavior: "smooth" }); };

  return (
    <div style={{ width: PDF_W }} className="rounded-lg border-2 border-amber-500 bg-neutral-100 shadow-lg dark:bg-neutral-800">
      <Handle type="target" id="anchor" position={Position.Left} style={{ opacity: 0, pointerEvents: "none", top: PDF_HEADER / 2 }} />
      <div style={{ height: PDF_HEADER }} className="flex cursor-grab items-center gap-2 rounded-t-md bg-amber-500 px-3 text-[12px] font-medium text-white active:cursor-grabbing">
        <span>Source PDF</span>
        {layout && (
          <span className="ml-auto flex items-center gap-1 text-[11px]">
            <button type="button" onClick={() => go(-1)} disabled={first === 0} className="nodrag rounded px-1.5 hover:bg-white/20 disabled:opacity-40" title="Previous page">◀</button>
            <span>{first === last ? `page ${first + 1}` : `pages ${first + 1}–${last + 1}`} of {layout.pages.length}</span>
            <button type="button" onClick={() => go(1)} disabled={first >= layout.pages.length - 1} className="nodrag rounded px-1.5 hover:bg-white/20 disabled:opacity-40" title="Next page">▶</button>
          </span>
        )}
        <button type="button" onClick={() => setPdfOpen(false)} title="Hide the PDF" className={`nodrag rounded px-1.5 hover:bg-white/20 ${layout ? "" : "ml-auto"}`}>✕</button>
      </div>
      <div ref={box} onScroll={onScroll} style={{ height: layout?.viewH ?? 320 }} className="nowheel nodrag relative overflow-y-auto overflow-x-hidden">
        {error && <div className="p-4 text-[12px] text-red-600">The PDF could not be loaded: {error}</div>}
        {!error && !pdf && <div className="p-4 text-[12px] text-neutral-500">Loading the PDF…</div>}
        {pdf && layout && (
          <div style={{ height: layout.total, position: "relative" }}>
            {layout.pages.map((pg, i) => (
              <div key={i} style={{ position: "absolute", top: pg.top, left: 0, width: pg.w, height: pg.h, marginBottom: PAGE_GAP }} className="shadow">
                <Page pdf={pdf} index={i} layout={layout} />
                <Highlights page={i + 1} layout={layout} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
