import type { NodeId, SourceRef, TreeDocument } from "@/types/tree";
import { deriveTree, orderedNodes } from "./derive";

export interface SourceItem { key: string; nodeId: NodeId; index: number; n: number; ref: SourceRef }

export interface PageLayout { top: number; scale: number; w: number; h: number }
export interface PdfLayout { pages: PageLayout[]; viewH: number; total: number }

export const PDF_NODE_ID = "pdf";
export const PDF_W = 560;
export const PDF_HEADER = 36;
export const PAGE_GAP = 12;
export const JUMP_OFFSET = 60;

export function listSources(doc: TreeDocument): SourceItem[] {
  const out: SourceItem[] = [];
  let n = 0;
  for (const d of orderedNodes(deriveTree(doc), doc.tree.rootNodeId)) {
    (d.node.sources ?? []).forEach((ref, index) => { n += 1; out.push({ key: `${d.node.id}:${index}`, nodeId: d.node.id, index, n, ref }); });
  }
  return out;
}

export function layoutPages(sizes: { w: number; h: number }[]): PdfLayout {
  const pages: PageLayout[] = [];
  let top = 0;
  for (const s of sizes) {
    const scale = PDF_W / s.w;
    const h = Math.round(s.h * scale);
    pages.push({ top, scale, w: PDF_W, h });
    top += h + PAGE_GAP;
  }
  const total = Math.max(0, top - PAGE_GAP);
  const third = pages[2] ? pages[2].top + pages[2].h : total;
  return { pages, viewH: Math.min(total, third), total };
}

export function sourceScrollTop(layout: PdfLayout, ref: SourceRef): number {
  const pg = layout.pages[ref.page - 1];
  if (!pg) return 0;
  return Math.max(0, pg.top + ref.y * pg.scale - JUMP_OFFSET);
}

export function sourcePoint(layout: PdfLayout | null, pdfPos: { x: number; y: number }, scrollTop: number, ref: SourceRef): { x: number; y: number; visible: boolean } {
  const pg = layout?.pages[ref.page - 1];
  if (!pg || !layout) return { x: pdfPos.x, y: pdfPos.y + PDF_HEADER, visible: false };
  const yDoc = pg.top + (ref.y + ref.h / 2) * pg.scale - scrollTop;
  const visible = yDoc >= 0 && yDoc <= layout.viewH;
  return { x: pdfPos.x + ref.x * pg.scale, y: pdfPos.y + PDF_HEADER + Math.min(Math.max(yDoc, 0), layout.viewH), visible };
}
