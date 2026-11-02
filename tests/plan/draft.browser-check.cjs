const {chromium,expect:baseExpect}=require('@playwright/test'),fs=require('node:fs');
const expect=baseExpect.configure({timeout:20000});
function pdf(){
 const stream='1 0 0 rg 10 20 80 4 re f';
 const objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> /Contents 4 0 R >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
 let s='%PDF-1.4\n',offsets=[];for(let i=0;i<objs.length;i++){offsets.push(s.length);s+=`${i+1} 0 obj\n${objs[i]}\nendobj\n`;}const x=s.length;s+=`xref\n0 5\n0000000000 65535 f \n${offsets.map(n=>n.toString().padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;return Buffer.from(s);
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  const page=await browser.newPage({viewport:{width:390,height:950}}),errors=[];page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
  const base=process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:3121',project='00000000-0000-4000-8000-000000000010';
  const ws=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('plano.workspace.v1')));
  const cache=()=>page.evaluate(()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('plano.plan-capture.'));return JSON.parse(localStorage.getItem(key));});
  await page.goto(`${base}/proyectos/${project}/plano`);await expect(page.getByRole('heading',{name:'Tus planos',exact:true})).toBeVisible();
  const approved=(await ws()).versions.filter(v=>v.status==='approved');
  await page.locator('input[type=file][accept="application/pdf"]').setInputFiles({name:'Plano Demolicion.pdf',mimeType:'application/pdf',buffer:pdf()});
  await expect(page.getByTitle('Plano Demolicion.pdf',{exact:true})).toBeVisible({timeout:30000});
  const save=()=>page.getByRole('button',{name:'Guardar preparación',exact:true});
  await save().click();await expect(save()).toBeDisabled();expect((await ws()).plan_captures[0].revision).toBe(1);
  await page.getByRole('button',{name:/Siguiente: mide y confirma/}).click();
  const svg=page.locator('svg[data-picking="true"]');
  for(const point of [[10,80],[90,80]]){const p=await svg.evaluate((el,point)=>{const s=new DOMPoint(...point).matrixTransform(el.getScreenCTM());return {x:s.x,y:s.y};},point);await page.mouse.click(p.x,p.y);}
  await page.getByRole('textbox',{name:'Metros',exact:true}).fill('8');
  await expect(page.getByText(/Escala lista/)).toBeVisible();
  await save().click();await expect(save()).toBeDisabled();
  const measured=(await ws()).plan_captures[0];expect(measured.draft.medida.metros).toBe('8');expect(measured.draft.planos[0].documentId).toBe((await ws()).documents[0].id);
  // Sin copia del navegador, el proyecto recupera geometría, página, escala y decisiones.
  await page.evaluate(()=>{for(const key of Object.keys(localStorage))if(key.startsWith('plano.plan-capture.')||key.startsWith('plano.borrador.'))localStorage.removeItem(key);});
  await page.reload();await expect(page.getByRole('textbox',{name:'Metros',exact:true})).toHaveValue('8');await expect(page.getByText(/Escala lista/)).toBeVisible();await expect(save()).toBeDisabled();console.log('Medida y original recuperados sin copia local');
  // Si no hay cambios locales, abrir de nuevo carga la última revisión sin un falso conflicto.
  await page.evaluate(()=>{const key='plano.workspace.v1',data=JSON.parse(localStorage.getItem(key));data.plan_captures[0].revision++;data.plan_captures[0].draft.medida.metros='8.5';localStorage.setItem(key,JSON.stringify(data));});
  await page.reload();await expect(page.getByRole('textbox',{name:'Metros',exact:true})).toHaveValue('8.5');await expect(save()).toBeDisabled();

  // Edición local no guardada y una edición remota posterior: se conserva la primera y se bloquea la sobrescritura.
  await page.getByRole('textbox',{name:'Metros',exact:true}).fill('7');await expect(save()).toBeEnabled();
  await expect.poll(async()=>(await cache()).draft.medida.metros).toBe('7');
  await page.evaluate(()=>{const key='plano.workspace.v1',data=JSON.parse(localStorage.getItem(key));data.plan_captures[0].revision++;data.plan_captures[0].draft.medida.metros='9';data.plan_captures[0].updated_by_name='Otra persona';localStorage.setItem(key,JSON.stringify(data));});
  await page.reload();await expect(page.getByRole('textbox',{name:'Metros',exact:true})).toHaveValue('7');await expect(page.getByRole('alert').filter({hasText:'Hay una preparación más reciente'})).toBeVisible();await expect(save()).toBeDisabled();
  await page.getByRole('button',{name:'Cargar la guardada',exact:true}).click();const dialog=page.getByRole('dialog',{name:'¿Cargar la preparación guardada?'});await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Seguir con mi edición'}).click();await expect(page.getByRole('textbox',{name:'Metros',exact:true})).toHaveValue('7');
  await page.getByRole('button',{name:'Cargar la guardada',exact:true}).click();await dialog.getByRole('button',{name:'Cargar la guardada',exact:true}).click();await expect(page.getByRole('textbox',{name:'Metros',exact:true})).toHaveValue('9');await expect(save()).toBeDisabled();console.log('Conflicto conservado y carga expresamente confirmada');
  await page.getByRole('textbox',{name:'Metros',exact:true}).fill('8');
  await page.getByRole('button',{name:/Siguiente:/}).click();await expect(page.getByRole('heading',{name:'Qué se hace y qué entra en el presupuesto'})).toBeVisible();
  const review=await cache();expect(review.draft.trabajos.demoler.articleId).toBeTruthy();
  await save().click();await expect(save()).toBeDisabled();
  await expect(page.getByRole('checkbox',{name:/Demoler las paredes que se tiran/})).toBeVisible();
  fs.mkdirSync('test-results/plan-draft',{recursive:true});
  for(const width of [390,768,1280]){await page.setViewportSize({width,height:950});for(const theme of ['light','dark']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,elements:[...document.querySelectorAll('main *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>({tag:el.tagName,cls:el.className,text:el.textContent.slice(0,90),right:el.getBoundingClientRect().right})).slice(-12)}));if(overflow.scroll>width)console.log(JSON.stringify({theme,overflow}));await page.screenshot({path:`test-results/plan-draft/${width}-${theme}.png`,fullPage:true});expect(overflow.scroll>width).toBe(false);}}
  // El guardado de preparación no cambia presupuestos. Incorporar exige resolver duplicados de forma expresa.
  expect((await ws()).versions.filter(v=>v.status==='approved')).toEqual(approved);
  for(const radio of await page.getByRole('radio',{name:'Añadir aparte',exact:true}).all())await radio.click();
  await page.getByRole('button',{name:/Añadir 1 partida a la V2/}).click();await page.waitForURL(`**/proyectos/${project}?s=budget&p=*`);
  const after=await ws();expect(after.versions.filter(v=>v.status==='approved')).toEqual(approved);expect(after.versions.find(v=>v.id.endsWith('061')).items.at(-1).quantity).toBe(20.8);
  expect(errors).toEqual([]);console.log(JSON.stringify({restoredWithoutBrowserCopy:true,conflictPreservesLocal:true,explicitReload:true,pdfLinked:true,quantity:20.8,approvedIntact:true,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
