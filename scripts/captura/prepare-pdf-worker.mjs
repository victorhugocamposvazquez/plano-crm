import { createRequire } from "node:module";
import { mkdir, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
const require=createRequire(import.meta.url);
const root=dirname(require.resolve("pdfjs-dist/package.json"));
const output=resolve(import.meta.dirname,"../../public/pdfjs");
await mkdir(output,{recursive:true});
await copyFile(resolve(root,"build/pdf.worker.min.mjs"),resolve(output,"pdf.worker.min.mjs"));
await copyFile(resolve(root,"LICENSE"),resolve(output,"LICENSE"));
