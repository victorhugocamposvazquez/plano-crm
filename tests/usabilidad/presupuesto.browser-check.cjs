const {chromium,expect:baseExpect}=require('@playwright/test');
const expect=baseExpect.configure({timeout:20000});
const fs=require('node:fs'),path=require('node:path');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
 try{
  const page=await browser.newPage({viewport:{width:390,height:950}}),errors=[],base=process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:3119',out='test-results/usabilidad';fs.mkdirSync(out,{recursive:true});
  page.setDefaultTimeout(20000);page.on('pageerror',e=>{errors.push(e.message);console.error(page.url(), e.message);});
  const project=id(10),url=`${base}/proyectos/${project}`;
  await page.goto(url);await page.getByRole('tab',{name:'Resumen',exact:true}).waitFor({timeout:30000});await expect(page.getByRole('tab',{name:'Resumen',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('button',{name:/Ver presupuesto y versiones/})).toBeVisible();
  await page.screenshot({path:path.join(out,'resumen-390-light.png'),fullPage:true});console.log('Resumen visible');
  await page.getByRole('tab',{name:'Presupuesto',exact:true}).click();
  const pill=n=>page.getByRole('button',{name:new RegExp(`^V${n} `)}),pressed=async n=>expect(pill(n)).toHaveAttribute('aria-pressed','true');await expect(pill(2)).toBeVisible();await pressed(2);await expect(pill(2).locator("time")).toHaveCount(1);await expect(pill(1)).toContainText("Para obra");console.log('Fila de versiones visible');
  expect(await page.locator('.budget-chapter[open]').count()).toBeGreaterThan(0);
  const breakdown=page.locator('.budget-summary-details');await expect(breakdown).not.toHaveAttribute('open','');
  await breakdown.locator('summary').click();await expect(breakdown.getByText('Creada por',{exact:true})).toBeVisible();await breakdown.locator('summary').click();
  await page.getByRole('button',{name:'Plegar todo',exact:true}).click();await expect(page.locator('.budget-chapter[open]')).toHaveCount(0);
  await page.reload();await pressed(2);await expect(page.locator('.budget-chapter[open]')).toHaveCount(0);
  await page.getByRole('button',{name:'Desplegar todo',exact:true}).click();expect(await page.locator('.budget-chapter[open]').count()).toBeGreaterThan(0);
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:950});for(const theme of ['light','dark']){
    await page.evaluate(t=>{localStorage.setItem('plano.theme',t);document.documentElement.dataset.theme=t;},theme);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:path.join(out,`lectura-${width}-${theme}.png`),fullPage:true});
  }}
  await page.setViewportSize({width:390,height:950});await page.evaluate(()=>{localStorage.setItem('plano.text','large');document.documentElement.dataset.text='large';});await page.reload();await pressed(2);
  await expect(page.locator('html')).toHaveAttribute('data-text','large');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  await page.screenshot({path:path.join(out,'lectura-390-letra-grande.png'),fullPage:true});await page.evaluate(()=>{localStorage.removeItem('plano.text');delete document.documentElement.dataset.text;});
  await page.getByRole('button',{name:'Historial de versiones',exact:true}).click();await expect(page.getByRole('heading',{name:'Versiones del presupuesto'})).toBeVisible();
  await expect(page.locator('.budget-history-card')).toHaveCount(2);console.log('Historial visible');
  await page.getByRole('button',{name:'Ver qué cambió',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Desde',exact:true})).toHaveValue(id(60));await expect(page.getByRole('combobox',{name:'Hasta',exact:true})).toHaveValue(id(61));
  await expect(page.getByRole('heading',{name:'Condiciones',exact:true})).toBeVisible();
  expect(new URL(page.url()).searchParams.get('desde')).toBe(id(60));expect(new URL(page.url()).searchParams.get('hasta')).toBe(id(61));console.log('Comparación inicial correcta');
  // Casos sintéticos de versiones: una cerrada histórica y una aprobada posterior con solo cambios contractuales.
  await page.evaluate(({v3})=>{const key='plano.workspace.v1',ws=JSON.parse(localStorage.getItem(key)),draft=ws.versions.find(v=>v.number===2);draft.status='issued';const next={...structuredClone(draft),id:v3,number:3,status:'approved',notes:'Entrega en ocho semanas. Anticipo del 30%.',approved_at:new Date().toISOString(),approval_reference:'Aceptación sintética',change_reason:'Cambio de condiciones'};ws.versions.push(next);ws.budgets.find(b=>b.id===draft.budget_id).approved_version_id=v3;localStorage.setItem(key,JSON.stringify(ws));},{v3:id(803)});
  await page.goto(`${url}?s=budget`);await pressed(3);await expect(page.getByRole('button',{name:'Editar partidas',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Historial de versiones',exact:true}).click();await page.locator('.budget-history-card').filter({has:page.locator('.version-identity-line strong',{hasText:/^V3$/})}).getByRole('button',{name:'Ver qué cambió'}).click();
  await expect(page.getByText('El total se mantiene',{exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Condiciones',exact:true})).toBeVisible();
  await expect(page.getByText(/No hay cambios en partidas ni condiciones/)).toHaveCount(0);
  await page.goto(`${url}?s=budget&v=${id(803)}`);await pressed(3);await page.getByRole('button',{name:/^Más opciones de la V3/}).click();await page.getByRole('menuitem',{name:/versión nueva/i}).click();
  const revision=page.getByRole('dialog',{name:'Versión nueva desde la V3',exact:true});await revision.getByLabel('Motivo del cambio').fill('Nueva propuesta sintética');await revision.getByRole('button',{name:'Crear la versión nueva',exact:true}).click();await expect(revision).not.toBeVisible();
  const v4Id=await page.evaluate(()=>JSON.parse(localStorage.getItem('plano.workspace.v1')).versions.find(v=>v.number===4).id);await pressed(4);
  await page.goto(`${url}?s=budget&vista=changes&desde=${id(60)}&hasta=${v4Id}`);
  const overlay=await page.evaluate(()=>{const sr=document.querySelector('nextjs-portal')?.shadowRoot;return sr?[...sr.children].filter(e=>e.tagName!=='STYLE').map(e=>e.innerText||'').join(' ').replace(/\s+/g,' ').slice(0,900):'';});if(overlay)console.log('Overlay de Next:',overlay);
  const reports=[];
  for(const width of [390,768,1280]){
   await page.setViewportSize({width,height:950});
   for(const theme of ['light','dark']){
    // El tema se fija por localStorage + data-theme (como hace ThemeToggle): la insignia de Next en desarrollo tapa el conmutador del pie del menú.
    await page.evaluate(t=>{localStorage.setItem('plano.theme',t);document.documentElement.dataset.theme=t;},theme);
    await expect(page.getByRole('heading',{name:'Qué cambió entre versiones'})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await page.screenshot({path:path.join(out,`comparacion-${width}-${theme}.png`),fullPage:true});reports.push({width,theme});
   }
  }
  await page.setViewportSize({width:390,height:950});
  await page.getByRole('button',{name:/^Partidas de V/}).click();await page.getByRole('button',{name:'Historial de versiones',exact:true}).click();await expect(page.getByRole('heading',{name:'Versiones del presupuesto'})).toBeVisible();await page.screenshot({path:path.join(out,'versiones-390-dark.png'),fullPage:true});
  await page.getByRole('button',{name:/^Partidas de V/}).click();await pill(4).click();await pressed(4);await expect(page.getByRole('region',{name:'Partidas de V4',exact:true})).toBeVisible();
  const approvedBefore=await page.evaluate(v3=>JSON.parse(localStorage.getItem('plano.workspace.v1')).versions.find(v=>v.id===v3),id(803));
  await page.getByRole('button',{name:'Editar partidas',exact:true}).click();
  const editor=page.getByRole('dialog',{name:'Editar V4 · partidas',exact:true});await expect(editor).toBeVisible();
  const firstChapter=editor.locator('.editor-chapter-fold').first();if(!await firstChapter.evaluate(el=>el.open))await firstChapter.locator('summary').click();
  await editor.getByRole('textbox',{name:'Descripción',exact:true}).first().fill('');await editor.getByRole('textbox',{name:'Descripción',exact:true}).first().fill('Demolición comprobada');await expect(editor.locator('.editor-chapter-fold').first()).toHaveAttribute('open','');
  await editor.getByRole('spinbutton',{name:'Cantidad',exact:true}).first().fill('99');
  await expect(editor.getByRole('spinbutton',{name:'Ajuste en porcentaje',exact:true}).first()).not.toBeVisible();
  await editor.locator('.editor-advanced > summary').first().click();await editor.getByRole('spinbutton',{name:'Ajuste en porcentaje',exact:true}).first().fill('20');
  await page.screenshot({path:path.join(out,'editor-390-dark.png'),fullPage:true});
  await editor.getByRole('button',{name:/^Guardar V4(?: · \d+)?$/}).click();await expect(editor).not.toBeVisible();console.log('Editor guardado');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('plano.workspace.v1')));expect(saved.versions.find(v=>v.id===id(803))).toEqual(approvedBefore);expect(saved.versions.find(v=>v.id===v4Id).items[0].quantity).toBe(99);
  const itemEdit=saved.budget_item_events.find(e=>e.version_id===v4Id && e.item_id===saved.versions.find(v=>v.id===v4Id).items[0].id);
  expect(itemEdit.fields).toEqual(['description','quantity','adjustment_percent']);expect(itemEdit.actor_name).toBeTruthy();
  await page.goto(`${url}?s=budget&vista=changes&desde=${id(803)}&hasta=${v4Id}`);
  const change=page.getByRole('article',{name:'Cambios en '+approvedBefore.items[0].description,exact:true});
  await expect(change.getByText(/Última edición de esta partida en V4/)).toBeVisible();await expect(change.locator('time')).toHaveAttribute('datetime',itemEdit.occurred_at);
  await expect(change.locator('.comparison-calculation').first()).not.toHaveAttribute('open','');
  await change.locator('.comparison-calculation > summary').first().click();await expect(change.getByRole('region',{name:'Después · V4',exact:true})).toBeVisible();
  await page.screenshot({path:path.join(out,'partida-con-fecha-390-dark.png'),fullPage:true});
  await page.reload();await expect(change.locator('time')).toHaveAttribute('datetime',itemEdit.occurred_at);
  await page.goto(`${url}?s=budget&v=${v4Id}`);await pressed(4);
  await pill(1).click();await pressed(1);await expect(page.getByRole('button',{name:'Editar partidas',exact:true})).toHaveCount(0);await page.reload();await pressed(1);
  // Muchas versiones siguen siendo accesibles; la seleccionada aparece dentro de la fila, sin comprimir su texto.
  await page.evaluate(()=>{const key='plano.workspace.v1',ws=JSON.parse(localStorage.getItem(key)),v=ws.versions.find(v=>v.number===1);ws.versions.find(v=>v.number===4).status='superseded';for(let n=5;n<=12;n++)ws.versions.push({...structuredClone(v),id:crypto.randomUUID(),number:n,status:n===12?'draft':'superseded'});localStorage.setItem(key,JSON.stringify(ws));});
  await page.goto(`${url}?s=budget`);await pressed(12);const selected=await pill(12).boundingBox(),row=await page.locator('.version-row').boundingBox();expect(selected.x).toBeGreaterThanOrEqual(row.x-1);expect(selected.x+selected.width).toBeLessThanOrEqual(row.x+row.width+1);
  await page.getByRole('tab',{name:'Documentos',exact:true}).click();const checklist=page.locator('.document-checklist');await expect(checklist).not.toHaveAttribute('open','');
  await expect(page.getByRole('heading',{name:'Archivos del proyecto'})).toBeVisible();await page.screenshot({path:path.join(out,'documentos-390-dark.png'),fullPage:true});
  await page.getByRole('button',{name:'Adjuntar',exact:true}).click();const upload=page.getByRole('dialog',{name:'Adjuntar archivos',exact:true});await expect(upload).toBeVisible();
  await upload.getByRole('button',{name:'Categoría del documento',exact:true}).click();await upload.getByRole('option',{name:'Fotos de antes',exact:true}).click();
  await upload.getByLabel('Seleccionar archivos',{exact:true}).setInputFiles({name:'visita-de-ejemplo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ioAAAAASUVORK5CYII=','base64')});
  await expect(upload).not.toBeVisible();await expect(page.getByRole('button',{name:'Abrir visita-de-ejemplo.png',exact:true})).toBeVisible();
  await checklist.locator('summary').click();await expect(checklist.getByText('1 de 5',{exact:true})).toBeVisible();await expect(checklist.getByText('Adjuntado',{exact:true})).toBeVisible();
  const document=await page.evaluate(()=>JSON.parse(localStorage.getItem('plano.workspace.v1')).documents.find(d=>d.name==='visita-de-ejemplo.png'));expect(document.category).toBe('before');expect(document.project_id).toBe(project);
  await page.goto(`${base}/`);await expect(page.getByText('Resumen de la empresa',{exact:true})).toBeVisible();
  expect(errors).toEqual([]);console.log(JSON.stringify({reports,freeVersionSelection:true,notesOnlyDetected:true,historicalReadonly:true,approvedUnchanged:true,editorSaved:true,chapterPreferenceSaved:true,manyVersionsVisible:true,documentUploaded:true,itemEditDateSaved:true,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
