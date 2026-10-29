import { readPdfBytes } from "./read-pdf";

/** PDF.js y su trabajador se cargan solo al elegir un PDF; no salen originales del navegador. */
export async function readPdfFile(file:File,options:Parameters<typeof readPdfBytes>[2]={}) {
  if(file.size===0 || file.size>50*1024*1024)throw new Error("El PDF debe tener contenido y ocupar como máximo 50 MB.");
  if(options?.signal?.aborted)throw new DOMException("Lectura cancelada","AbortError");
  const pdfjs=await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc="/pdfjs/pdf.worker.min.mjs";
  return readPdfBytes(new Uint8Array(await file.arrayBuffer()),pdfjs,options);
}
