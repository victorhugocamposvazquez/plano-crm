const {chromium,expect}=require('@playwright/test');
const fs=require('node:fs');const path=require('node:path');
const output=process.env.PLANO_BROWSER_OUTPUT || 'test-results/espacio';fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),
  headless:true,timeout:60000,args:process.env.PLAYWRIGHT_SOFTWARE_WEBGL==='1'?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]});
 try {
  const errors=[],reports=[];const base=process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3117';
  const page=await browser.newPage({viewport:{width:1280,height:1000}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/laboratorio/espacio`);await expect(page.getByText('Vista 3D lista',{exact:true})).toBeVisible({timeout:30000});
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.screenshot({path:path.join(output,'espacio-inicial.png'),fullPage:true});
  const initialBase=await page.getByTestId('visual-base').textContent();
  const initialDistance=Number(await page.locator('canvas').getAttribute('data-camera-distance'));
  await page.getByRole('button',{name:'Acercar',exact:true}).click();
  await expect.poll(async()=>Number(await page.locator('canvas').getAttribute('data-camera-distance'))).toBeLessThan(initialDistance);
  await page.getByRole('button',{name:'Alejar',exact:true}).click();
  await expect.poll(async()=>Number(await page.locator('canvas').getAttribute('data-camera-distance'))).toBeGreaterThan(initialDistance/1.18);
  await expect(page.getByTestId('visual-base')).toHaveText(initialBase);
  await page.getByRole('button',{name:'Entrar al espacio',exact:true}).click();await expect(page.getByRole('button',{name:'Entrar al espacio',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.screenshot({path:path.join(output,'espacio-interior.png'),fullPage:true});
  await page.getByRole('button',{name:'Vista general',exact:true}).click();
  await page.getByRole('button',{name:'Alternativa para Suelo',exact:true}).click();await page.getByRole('option',{name:/Pavimento de piedra instalado/}).click();
  await expect(page.getByTestId('visual-delta')).toContainText('+240,00');
  if(await page.getByTestId('visual-base').textContent()===initialBase) throw new Error('El precio no cambia con el artículo.');
  await page.getByRole('button',{name:/Mueble auxiliar 1 ud/}).click();
  await page.getByRole('button',{name:'Alternativa para Mueble auxiliar',exact:true}).click();await page.getByRole('option',{name:/Mueble auxiliar de 120 cm/}).click();
  await expect(page.getByTestId('visual-delta')).toContainText('+600,00');
  await page.getByRole('button',{name:'Ver elemento',exact:true}).click();
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar propuesta de ejemplo',exact:true}).click();
  const download=await downloadEvent,payload=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
  if(payload.price_snapshot.amounts.base!==238920 || payload.initial_price_snapshot.amounts.base!==178920 || payload.persisted_to_project!==false) throw new Error('Instantáneas económicas incorrectas.');
  await page.getByRole('button',{name:'Espacio de ejemplo',exact:true}).click();await page.getByRole('option',{name:'Nave de ejemplo',exact:true}).click();
  await expect(page.getByRole('button',{name:/Suelo 96 m²/})).toBeVisible();await expect(page.getByTestId('visual-delta')).toContainText('0,00');
  await expect(page.getByText('Vista 3D lista',{exact:true})).toBeVisible({timeout:30000});
  await page.screenshot({path:path.join(output,'nave.png'),fullPage:true});
  await page.getByRole('button',{name:/Estanterías 2 ud/}).click();await page.getByRole('button',{name:'Ver elemento',exact:true}).click();
  await expect.poll(async()=>Number(await page.locator('canvas').getAttribute('data-camera-distance'))).toBeGreaterThan(5);
  await page.screenshot({path:path.join(output,'nave-equipamiento.png'),fullPage:true});
  await page.getByRole('button',{name:'Espacio de ejemplo',exact:true}).click();await page.getByRole('option',{name:'Local de ejemplo',exact:true}).click();
  await expect(page.getByTestId('visual-delta')).toContainText('+600,00');
  await page.getByRole('button',{name:'Restaurar elecciones iniciales',exact:true}).click();await page.getByRole('button',{name:'Restaurar',exact:true}).click();
  await expect(page.getByTestId('visual-base')).toHaveText(initialBase);
  await expect(page.getByText('Vista 3D lista',{exact:true})).toBeVisible({timeout:30000});
  for(const width of [390,768,1280]) {
   await page.setViewportSize({width,height:950});
   for(const theme of ['light','dark']) {
    const toggle=page.getByRole('button',{name:/Tema .*cambiar/});if(await toggle.getAttribute('aria-pressed')!==(theme==='dark'?'true':'false')) await toggle.click();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow) throw new Error(`Desbordamiento a ${width} / ${theme}`);
    await page.screenshot({path:path.join(output,`espacio-${width}-${theme}.png`),fullPage:true});reports.push({width,theme,overflow});
   }
  }
  const fallback=await browser.newPage();await fallback.addInitScript(()=>{
   const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl2' || type==='webgl') return null;return original.call(this,type,...args);};
  });
  await fallback.goto(`${base}/laboratorio/espacio`);await expect(fallback.getByText(/La vista 3D no está disponible en este navegador/)).toBeVisible({timeout:30000});
  await fallback.getByRole('button',{name:'Alternativa para Suelo',exact:true}).click();await fallback.getByRole('option',{name:/Pavimento de piedra instalado/}).click();
  await expect(fallback.getByTestId('visual-delta')).toContainText('+240,00');await fallback.close();
  console.log(JSON.stringify({errors,reports,base:178920,modifiedBase:238920,download:true,sceneChoicesPreserved:true,webglFallback:true}));
  if(errors.length) throw new Error('Errores de ejecución en el visor.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
