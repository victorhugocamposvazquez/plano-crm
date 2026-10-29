const {chromium,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
function pdf(stream='1 0 0 rg 10 20 80 4 re f') {
 const objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> /Contents 4 0 R >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
 let s='%PDF-1.4\n',offsets=[];for(let i=0;i<objs.length;i++){offsets.push(s.length);s+=`${i+1} 0 obj\n${objs[i]}\nendobj\n`;}
 const x=s.length;s+=`xref\n0 5\n0000000000 65535 f \n${offsets.map(n=>n.toString().padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;return Buffer.from(s);
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined});
 try{
  const page=await browser.newPage({viewport:{width:390,height:950}}),errors=[],external=[],workers=[];
  page.setDefaultTimeout(15000);
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()) && !r.url().startsWith(base))external.push(r.url());if(r.url().includes('/pdfjs/'))workers.push(r.url());});
  const base=process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3119',project='00000000-0000-4000-8000-000000000010';
  await page.goto(`${base}/proyectos/${project}/plano`);
  await page.getByRole('button',{name:/Añadir y leer un plano/}).waitFor();
  const buffer=pdf();await page.locator('input[type=file][accept="application/pdf"]').setInputFiles({name:'Plano Demolicion.pdf',mimeType:'application/pdf',buffer});
  await expect(page.getByTitle('Plano Demolicion.pdf',{exact:true})).toBeVisible({timeout:30000});
  await expect(page.getByText(/1 página · 1 trazo · en Documentos/)).toBeVisible();
  const state=await page.evaluate(project=>({b:JSON.parse(localStorage.getItem('plano.borrador.'+project)),ws:JSON.parse(localStorage.getItem('plano.workspace.v1'))}),project);
  expect(state.ws.documents).toHaveLength(1);expect(state.b.planos[0].documentId).toBe(state.ws.documents[0].id);
  expect(state.b.planos[0].extraction.sha256).toBe(require('node:crypto').createHash('sha256').update(buffer).digest('hex'));
  expect(state.b.planos[0].lectura.partial).toBe(false);expect(workers.some(u=>u.endsWith('pdf.worker.min.mjs'))).toBe(true);
  const out=process.env.PLANO_BROWSER_OUTPUT || 'test-results/pdf-directo';fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'pdf-leido-390.png'),fullPage:true});
  // Un documento ya guardado se relee sin duplicar documento ni plano.
  await page.getByText('Leer un plano de Documentos (1)',{exact:true}).click();await page.getByRole('button',{name:'Leer este plano',exact:true}).click();
  await expect(page.getByRole('button',{name:/Añadir y leer un plano/})).toBeEnabled({timeout:30000});
  expect(await page.evaluate(project=>JSON.parse(localStorage.getItem('plano.borrador.'+project)).planos.length,project)).toBe(1);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('plano.workspace.v1')).documents.length)).toBe(1);
  // Un PDF vacío de dibujo queda señalado, aunque sea un archivo PDF válido.
  await page.locator('input[type=file][accept="application/pdf"]').setInputFiles({name:'Plano sin geometría.pdf',mimeType:'application/pdf',buffer:pdf('')});
  await expect(page.getByTitle('Plano sin geometría.pdf',{exact:true})).toBeVisible({timeout:30000});await expect(page.getByText('Lectura parcial · revisar',{exact:true})).toBeVisible();
  expect(external).toEqual([]);expect(errors).toEqual([]);
  console.log(JSON.stringify({errors,externalRequests:external.length,localWorker:true,documentLinked:true,sha256Verified:true,reReadWithoutDuplicates:true,emptyGeometryPending:true}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
