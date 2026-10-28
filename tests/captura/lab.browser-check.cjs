const {chromium,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const output=process.env.PLANO_BROWSER_OUTPUT || 'test-results/captura-lab';
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),headless:true,timeout:60000});
 try {
  const errors=[],reports=[];
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3117'}/laboratorio/planos`);
  await expect(page.getByRole('heading',{name:'Medir planos',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Incluir',exact:true})).toHaveCount(2);
  await page.getByRole('button',{name:'Incluir',exact:true}).nth(0).click();
  await page.getByRole('button',{name:'Incluir',exact:true}).nth(1).click();
  await expect(page.getByText('8 ml incluidos',{exact:true})).toBeVisible();
  const downloadEvent=page.waitForEvent('download');
  await page.getByRole('button',{name:'Descargar revisión',exact:true}).click();
  const download=await downloadEvent;const downloadPath=await download.path();const review=JSON.parse(fs.readFileSync(downloadPath,'utf8'));
  if(review.pages[0].proposals.filter(p=>p.decision==='included').length!==2) throw new Error('La revisión no conserva las decisiones.');
  await page.getByLabel('Distancia real (m)',{exact:true}).fill('10');
  await expect(page.getByText('0 ml incluidos',{exact:true})).toBeVisible();
  await expect(page.getByText('2 candidatos · 0 incluidos · 2 pendientes · 0 descartados',{exact:true})).toBeVisible();
  for(const width of [390,768,1280]) {
    await page.setViewportSize({width,height:950});
    for(const theme of ['light','dark']) {
      const toggle=page.getByRole('button',{name:/Tema .*cambiar/});
      if((await toggle.getAttribute('aria-pressed'))!==(theme==='dark'?'true':'false')) await toggle.click();
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
      if(overflow) throw new Error(`Desbordamiento a ${width} / ${theme}`);
      await page.screenshot({path:path.join(output,`plano-lab-${width}-${theme}.png`),fullPage:true});
      reports.push({width,theme,overflow});
    }
  }
  await page.getByRole('button',{name:'Incluir',exact:true}).nth(0).click();
  await page.getByRole('button',{name:'Ver ejemplo',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Cambiar de plano',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  await expect(page.getByText('10 ml incluidos',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Ver ejemplo',exact:true}).click();
  await page.getByRole('button',{name:'Cambiar plano',exact:true}).click();
  await expect(page.getByText('0 ml incluidos',{exact:true})).toBeVisible();
  if(process.env.PLANO_BENCH_PLAN_040) {
  await page.getByLabel('Abrir extracción de un plano',{exact:true}).setInputFiles({name:'plano-040.json',mimeType:'application/json',buffer:fs.readFileSync(process.env.PLANO_BENCH_PLAN_040)});
  await expect(page.getByText('plano-040.json',{exact:true})).toBeVisible({timeout:20000});
  await expect(page.getByText('Falta una referencia válida para calcular metros',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Significado del color RGB 255,0,0',exact:true}).click();
  await page.getByRole('option',{name:'Demoler',exact:true}).click();
  await expect(page.getByRole('button',{name:'Incluir',exact:true})).toHaveCount(11);
  if(await page.getByRole('button',{name:'Incluir',exact:true}).first().isEnabled()) throw new Error('Se permite incluir una medida sin escala.');
  await page.screenshot({path:path.join(output,'plano-lab-garal.png'),fullPage:true});
  }
  console.log(JSON.stringify({reports,errors,syntheticReview:'8 ml, dos decisiones exportadas y escala reabre revisión',realPlanCandidates:process.env.PLANO_BENCH_PLAN_040?11:null}));
  if(errors.length) throw new Error('Errores en el navegador.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
