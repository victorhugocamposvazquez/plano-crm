import {it,expect} from "vitest";
import {readFileSync,writeFileSync,existsSync} from "node:fs";
import {join} from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import {readPdfBytes} from "../../src/lib/captura/read-pdf";
const inventory=process.env.PLANO_PRIVATE_INVENTORY;
/** Optativa y solo local. No incluye originales ni nombres de clientes en el repositorio o la salida. */
it.skipIf(!inventory)("lee los planos del inventario privado sin enviar archivos fuera del equipo",async()=>{
 const rows=JSON.parse(readFileSync(inventory!,"utf8")) as {file:string;relative:string;extension:string}[];
 const files=rows.filter(r=>r.extension===".pdf" && /plano/i.test(r.relative));
 expect(files.length).toBeGreaterThan(0);
 const reports=[];
 for(let i=0;i<files.length;i++) {
  const file=files[i],path=existsSync(file.file)?file.file:join(process.env.PLANO_PRIVATE_ROOT ?? "",file.relative);
  const result=await readPdfBytes(new Uint8Array(readFileSync(path)),pdfjs);
  reports.push({index:i,sha256:result.extraction.sha256,...result.report});
  expect(result.report.stats.paths).toBeGreaterThan(0);
 }
 if(process.env.PLANO_PRIVATE_REPORT)writeFileSync(process.env.PLANO_PRIVATE_REPORT,JSON.stringify(reports,null,2));
 console.log(JSON.stringify({pdfs:reports.length,paths:reports.reduce((s,r)=>s+r.stats.paths,0),partial:reports.filter(r=>r.partial).length}));
},120000);
