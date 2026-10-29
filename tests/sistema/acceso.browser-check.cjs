const {chromium,expect}=require('@playwright/test');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});try{
 const page=await browser.newPage({viewport:{width:390,height:950}}),errors=[],base=process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:3119';page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}/sistema`);await page.getByRole('heading',{name:'Acceso reservado'}).waitFor({timeout:30000});await expect(page.getByRole('heading',{name:'Estado del producto'})).toHaveCount(0);
 const denied=await page.request.get(`${base}/sistema/acceso`);expect(denied.status()).toBe(403);expect(await denied.json()).toEqual({allowed:false});expect(denied.headers()['cache-control']).toContain('no-store');
 await page.goto(`${base}/mas`);await page.getByRole('heading',{name:'Más.',exact:true}).waitFor({timeout:30000});await expect(page.getByRole('link',{name:/Supervisión del sistema/})).toHaveCount(0);expect(errors).toEqual([]);
 console.log(JSON.stringify({superadminDenied:true,linkHidden:true,noStore:true,errors}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
