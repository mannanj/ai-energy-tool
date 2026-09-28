"use client";
import type { PDFDocumentProxy } from "pdfjs-dist";

let lib: Promise<typeof import("pdfjs-dist")> | null = null;

export async function pdfjs() {
  if (!lib) {
    lib = import("pdfjs-dist").then((m) => { m.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"; return m; });
  }
  return lib;
}

export async function openPdf(url: string): Promise<PDFDocumentProxy> {
  const m = await pdfjs();
  return m.getDocument({ url, withCredentials: true }).promise;
}
