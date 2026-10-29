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
  await expect(page.getByRole('button',{name:'Ver presupuesto y versiones',exact:true})).toBeVisible();
  await page.screenshot({path:path.join(out,'resumen-390-light.png'),fullPage:true});console.log('Resumen visible');
  await page.getByRole('tab',{name:'Presupuesto',exact:true}).click();
  const picker=page.getByRole('combobox',{name:'Versión que estás viendo',exact:true});await expect(picker).toBeVisible();console.log('Selector de versiones visible');
  await expect(page.locator('.budget-chapter[open]')).toHaveCount(0);
  await page.getByRole('tab',{name:/^Versiones/}).click();await expect(page.getByRole('heading',{name:'Versiones del presupuesto'})).toBeVisible();
  await expect(page.locator('.budget-history-card')).toHaveCount(2);console.log('Historial visible');
  await page.getByRole('button',{name:'Ver qué cambió',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Desde',exact:true})).toHaveValue(id(60));await expect(page.getByRole('combobox',{name:'Hasta',exact:true})).toHaveValue(id(61));
  await expect(page.getByRole('heading',{name:'Notas y condiciones modificadas'})).toBeVisible();
  expect(new URL(page.url()).searchParams.get('desde')).toBe(id(60));expect(new URL(page.url()).searchParams.get('hasta')).toBe(id(61));console.log('Comparación inicial correcta');
  // Casos sintéticos de versiones: una cerrada histórica y una aprobada posterior con solo cambios contractuales.
  await page.evaluate(({v3})=>{const key='plano.workspace.v1',ws=JSON.parse(localStorage.getItem(key)),draft=ws.versions.find(v=>v.number===2);draft.status='issued';const next={...structuredClone(draft),id:v3,number:3,status:'approved',notes:'Entrega en ocho semanas. Anticipo del 30%.',approved_at:new Date().toISOString(),approval_reference:'Aceptación sintética',change_reason:'Cambio de condiciones'};ws.versions.push(next);ws.budgets.find(b=>b.id===draft.budget_id).approved_version_id=v3;localStorage.setItem(key,JSON.stringify(ws));},{v3:id(803)});
  await page.goto(`${url}?s=budget`);await expect(picker).toHaveValue(id(803));await expect(page.getByRole('button',{name:'Editar presupuesto',exact:true})).toHaveCount(0);
  await page.getByRole('tab',{name:/^Versiones/}).click();await page.locator('.budget-history-card').filter({has:page.getByText('V3',{exact:true})}).getByRole('button',{name:'Ver qué cambió'}).click();
  await expect(page.getByText('0 añadidas · 0 modificadas · 0 eliminadas · condiciones actualizadas',{exact:true})).toBeVisible();
  await expect(page.getByText(/No hay cambios en partidas ni condiciones/)).toHaveCount(0);
  await picker.selectOption(id(803));await page.getByRole('button',{name:'Nueva revisión',exact:true}).click();
  const revision=page.getByRole('dialog',{name:'Nueva revisión desde la V3',exact:true});await revision.getByLabel('Motivo del cambio').fill('Nueva propuesta sintética');await revision.getByRole('button',{name:'Abrir revisión',exact:true}).click();await expect(revision).not.toBeVisible();
  const v4Id=await page.evaluate(()=>JSON.parse(localStorage.getItem('plano.workspace.v1')).versions.find(v=>v.number===4).id);await expect(picker).toHaveValue(v4Id);
  await page.goto(`${url}?s=budget&vista=changes&desde=${id(60)}&hasta=${v4Id}`);
  const reports=[];
  for(const width of [390,768,1280]){
   await page.setViewportSize({width,height:950});
   for(const theme of ['light','dark']){
    const toggle=page.getByRole('button',{name:/Tema .*cambiar/});if(await toggle.getAttribute('aria-pressed')!==(theme==='dark'?'true':'false'))await toggle.click();
    await expect(page.getByRole('heading',{name:'Qué cambió entre versiones'})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await page.screenshot({path:path.join(out,`comparacion-${width}-${theme}.png`),fullPage:true});reports.push({width,theme});
   }
  }
  await page.setViewportSize({width:390,height:950});
  await page.getByRole('tab',{name:/^Versiones/}).click();await expect(page.getByRole('heading',{name:'Versiones del presupuesto'})).toBeVisible();await page.screenshot({path:path.join(out,'versiones-390-dark.png'),fullPage:true});
  await picker.selectOption(v4Id);await expect(page.getByRole('tab',{name:'Partidas',exact:true})).toHaveAttribute('aria-selected','true');
  const approvedBefore=await page.evaluate(v3=>JSON.parse(localStorage.getItem('plano.workspace.v1')).versions.find(v=>v.id===v3),id(803));
  await page.getByRole('button',{name:'Editar presupuesto',exact:true}).click();
  const editor=page.getByRole('dialog',{name:'Partidas · V4',exact:true});await expect(editor).toBeVisible();
  await editor.locator('.editor-chapter-fold > summary').first().click();
  await editor.getByRole('textbox',{name:'Descripción',exact:true}).first().fill('');await editor.getByRole('textbox',{name:'Descripción',exact:true}).first().fill('Demolición comprobada');await expect(editor.locator('.editor-chapter-fold').first()).toHaveAttribute('open','');
  await editor.getByRole('spinbutton',{name:'Cantidad',exact:true}).first().fill('99');
  await expect(editor.getByRole('spinbutton',{name:'Ajuste en porcentaje',exact:true}).first()).not.toBeVisible();
  await editor.locator('.editor-advanced > summary').first().click();await editor.getByRole('spinbutton',{name:'Ajuste en porcentaje',exact:true}).first().fill('20');
  await page.screenshot({path:path.join(out,'editor-390-dark.png'),fullPage:true});
  await editor.getByRole('button',{name:'Guardar V4',exact:true}).click();await expect(editor).not.toBeVisible();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('plano.workspace.v1')));expect(saved.versions.find(v=>v.id===id(803))).toEqual(approvedBefore);expect(saved.versions.find(v=>v.id===v4Id).items[0].quantity).toBe(99);
  await picker.selectOption(id(60));await expect(page.getByRole('button',{name:'Editar presupuesto',exact:true})).toHaveCount(0);await page.reload();await expect(picker).toHaveValue(id(60));
  await page.goto(`${base}/`);await expect(page.getByText('Resumen de la empresa',{exact:true})).toBeVisible();
  expect(errors).toEqual([]);console.log(JSON.stringify({reports,freeVersionSelection:true,notesOnlyDetected:true,historicalReadonly:true,approvedUnchanged:true,editorSaved:true,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
