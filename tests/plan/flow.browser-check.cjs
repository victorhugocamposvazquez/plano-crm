const {chromium,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const output=process.env.PLANO_BROWSER_OUTPUT || 'test-results/plan-flow';fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:950}}),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);if(errors.length<4) console.error(e.message);});
  const base=process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3117';
  const project='00000000-0000-4000-8000-000000000010';
  await page.goto(`${base}/proyectos/${project}/plano`);
  await page.getByRole('button',{name:'Probar con planos de ejemplo',exact:true}).click();
  await page.getByRole('button',{name:/Siguiente: dale una medida/}).click();
  const svg=page.locator('svg[data-picking="true"]');
  for(const point of [[20,20],[480,20]]) {
   const p=await svg.evaluate((el,point)=>{const screen=new DOMPoint(...point).matrixTransform(el.getScreenCTM());return {x:screen.x,y:screen.y};},point);
   await page.mouse.click(p.x,p.y);
  }
  await page.getByRole('textbox',{name:'Metros',exact:true}).fill('9,2');
  const next=page.getByRole('button',{name:/Faltan medidas:/});await expect(next).toBeDisabled();
  const confirms=page.getByRole('checkbox',{name:/Confirmo la misma escala/});await expect(confirms).toHaveCount(2);
  for(const c of await confirms.all()) await c.check();
  await expect(page.getByText('Misma escala confirmada',{exact:true})).toHaveCount(2);
  // Revisar la referencia anula ambas confirmaciones: no puede pasar con las antiguas.
  await page.getByRole('textbox',{name:'Metros',exact:true}).fill('4,6');
  await expect(page.getByRole('button',{name:/Faltan medidas:/})).toBeDisabled();
  await page.getByRole('textbox',{name:'Metros',exact:true}).fill('9,2');
  for(const c of await confirms.all()) await c.check();
  const reports=[];
  for(const width of [390,768,1280]) {
   await page.setViewportSize({width,height:950});
   for(const theme of ['light','dark']) {
    const toggle=page.getByRole('button',{name:/Tema .*cambiar/});
    if(await toggle.getAttribute('aria-pressed')!==(theme==='dark'?'true':'false')) await toggle.click();
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw new Error(`Desbordamiento ${width} ${theme}`);
    await page.screenshot({path:path.join(output,`escala-${width}-${theme}.png`),fullPage:true});reports.push({width,theme});
   }
  }
  await page.getByRole('button',{name:/Siguiente: confirma las paredes/}).click();
  await page.getByRole('button',{name:/Siguiente: ¿qué se hace/}).click();
  await page.getByRole('textbox',{name:'Huecos en paredes nuevas en metros cuadrados',exact:true}).fill('2');
  await page.getByRole('textbox',{name:'Huecos en paredes de demolición en metros cuadrados',exact:true}).fill('1');
  await page.getByRole('checkbox',{name:/Pintar las paredes nuevas/}).check();
  await page.getByRole('button',{name:/Ver las partidas/}).click();
  const save=page.getByRole('button',{name:/Añadir 3 partidas a la V2/});await expect(save).toBeDisabled();
  await expect(page.getByText(/Elige qué hacer con cada coincidencia/)).toBeVisible();
  for(const radio of await page.getByRole('radio',{name:'Añadir aparte',exact:true}).all()) await radio.click();
  await expect(save).toBeEnabled();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('plano.workspace.v1')));
  const approvedBefore=before.versions.find(v=>v.status==='approved');
  await page.screenshot({path:path.join(output,'revision.png'),fullPage:true});
  await save.click();await page.waitForURL(`**/proyectos/${project}?s=budget&p=*`);
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('plano.workspace.v1')));
  const current=after.versions.find(v=>v.id==='00000000-0000-4000-8000-000000000061');
  expect(after.versions.find(v=>v.id===approvedBefore.id)).toEqual(approvedBefore);
  expect(current.items.slice(-3).map(i=>i.quantity)).toEqual([9.4,4.24,8.48]);
  expect(current.draft_revision).toBe(1);
  expect(errors).toEqual([]);
  console.log(JSON.stringify({reports,errors,quantities:[9.4,4.24,8.48],approvedUnchanged:true,explicitReplacementDecision:true}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
