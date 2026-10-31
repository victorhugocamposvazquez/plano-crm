/*
 * Recorrido de navegador de la propuesta de usabilidad, en modo demostración (sin Supabase).
 * Uso: PLAYWRIGHT_BASE_URL=http://127.0.0.1:3119 node tests/usabilidad/presupuesto.browser-check.cjs
 */
const {chromium,expect:baseExpect}=require('@playwright/test');
const expect=baseExpect.configure({timeout:20000});
const fs=require('node:fs'),path=require('node:path');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const base=process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:3119',out='test-results/usabilidad';
const ws=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('plano.workspace.v1')));
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
 const errors=[];
 try{
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  const page=await context.newPage();page.setDefaultTimeout(20000);
  page.on('pageerror',e=>{errors.push(e.message);console.error(page.url(),e.message);});
  page.on('console',m=>{if(m.type()==='error' && !/favicon|Failed to load resource/.test(m.text())){errors.push(m.text().slice(0,300));console.error(page.url(),m.text().slice(0,300));}});
  const project=id(10),url=`${base}/proyectos/${project}`;

  // Armazón: Hoy, «+ Nuevo» y cuenta se cierran al pulsar fuera.
  await page.goto(`${base}/`);await expect(page.getByRole('heading',{level:1})).toContainText(/Buen/);
  await expect(page.getByRole('region',{name:'Lo primero'})).toBeVisible();
  await page.getByRole('button',{name:'Nuevo',exact:true}).click();await expect(page.getByRole('menuitem',{name:/^Tarea/})).toBeVisible();
  await page.getByRole('heading',{level:1}).click();await expect(page.getByRole('menuitem',{name:/^Tarea/})).toHaveCount(0);
  await page.getByRole('button',{name:'Nuevo',exact:true}).click();await page.getByRole('menuitem',{name:/^Tarea/}).click();
  const tarea=page.getByRole('dialog',{name:'Tarea'});await tarea.getByLabel('Qué hay que hacer').fill('Tarea del recorrido');await tarea.getByRole('button',{name:'Crear tarea'}).click();await expect(tarea).not.toBeVisible();
  expect((await ws(page)).tasks.some(t=>t.title==='Tarea del recorrido')).toBe(true);
  await page.getByRole('button',{name:/^Tu cuenta/}).first().click();await expect(page.getByRole('link',{name:'Ayuda'})).toBeVisible();
  await page.getByRole('heading',{level:1}).click();await expect(page.getByRole('link',{name:'Ayuda'})).toHaveCount(0);
  console.log('Armazón correcto');

  // Búsqueda tolerante: un error de dos letras encuentra el proyecto; «05» no arrastra PL-005.
  await page.goto(`${base}/proyectos`);const buscar=page.getByRole('searchbox',{name:'Buscar proyectos'});
  await buscar.fill('vivenda');await expect(page.getByRole('link',{name:/Vivienda en Monte Alto/})).toBeVisible();await expect(page.getByRole('link',{name:/Reforma de baño/})).toHaveCount(0);
  await buscar.fill('cliente 05');await expect(page.getByRole('link',{name:/Reforma de baño/})).toBeVisible();await expect(page.getByRole('link',{name:/Vivienda en Monte Alto/})).toHaveCount(0);
  await buscar.fill('');await page.getByRole('button',{name:/^Obra \d/}).click();await expect(page.getByRole('link',{name:/Reforma de baño/})).toHaveCount(0);
  console.log('Buscador correcto');

  // Presupuesto: añadir del catálogo acaba en el borrador abierto.
  await page.goto(`${url}?s=budget`);await expect(page.getByRole('button',{name:/^V2 .*la actual/})).toHaveAttribute('aria-pressed','true');
  const antes=(await ws(page)).versions.find(v=>v.number===2 && v.status==='draft');
  await page.getByRole('button',{name:'Añadir partidas'}).click();await page.getByRole('menuitem',{name:/^Del catálogo/}).click();
  const picker=page.getByRole('dialog',{name:'Añadir del catálogo'});await picker.getByRole('searchbox').fill('pintura');
  await picker.getByRole('button',{name:'Añadir',exact:true}).first().click();await picker.getByRole('textbox',{name:/^Cantidad de/}).fill('2');
  await picker.getByRole('button',{name:'Añadir 1 partida al borrador'}).click();await expect(picker).not.toBeVisible();
  const despues=(await ws(page)).versions.find(v=>v.id===antes.id);expect(despues.items.length).toBe(antes.items.length+1);expect(despues.items.at(-1).quantity).toBe(2);
  console.log('Catálogo → borrador correcto');
  await page.getByRole('button',{name:'Editar partidas'}).click();await expect(page.getByRole('dialog',{name:/Editar V2/})).toBeVisible();await page.keyboard.press('Escape');

  // Versiones y comparador, con fecha y autor de cada edición.
  await page.getByRole('button',{name:/^Versiones · /}).click();await expect(page.getByText('La actual · la última que se ha tocado')).toBeVisible();await expect(page.getByText('La estás preparando. Todavía no la ha visto el cliente.')).toBeVisible();
  await page.getByRole('button',{name:/^Ver qué cambia/}).click();await expect(page.getByLabel('Comparar con',{exact:true})).toBeVisible();await expect(page.getByText('La V2 cuesta')).toBeVisible();await expect(page.getByText(/Última edición:/).first()).toBeVisible();
  await page.getByText('Ver el detalle, antes y después').click();await expect(page.getByText(/El presupuesto (sube|baja)/)).toBeVisible();await expect(page.getByText(/Última edición de esta partida en V2/).first()).toBeVisible();
  console.log('Versiones y comparador correctos');

  // Enviar al cliente, responder «sí» y ver qué cambia en el proyecto.
  await page.getByRole('button',{name:'Enviar V2 al cliente'}).click();const envio=page.getByRole('dialog',{name:'Enviar la V2 al cliente'});
  await expect(envio.getByText('La V2 se cierra: ya no se puede editar.')).toBeVisible();await expect(envio.getByText(/La V1 sigue siendo la aceptada/)).toBeVisible();
  await envio.getByRole('button',{name:'Enviar por WhatsApp'}).click();const lista=page.getByRole('dialog',{name:'V2 lista para el cliente'});
  await expect(lista.getByRole('link',{name:'Abrir WhatsApp'})).toHaveAttribute('href',/^https:\/\/wa\.me\//);await lista.getByRole('button',{name:'Hecho'}).click();
  expect((await ws(page)).versions.find(v=>v.id===antes.id).status).toBe('issued');
  await page.getByRole('button',{name:'Registrar respuesta del cliente'}).click();const respuesta=page.getByRole('dialog',{name:/Qué ha dicho el cliente sobre la V2/});
  await expect(respuesta.getByText('Qué cambia en el proyecto si lo aceptas')).toBeVisible();await respuesta.getByRole('button',{name:'Marcar como aceptado'}).click();await expect(respuesta).not.toBeVisible();
  let estado=await ws(page);expect(estado.budgets.find(b=>b.id===antes.budget_id).approved_version_id).toBe(antes.id);expect(estado.versions.find(v=>v.id===antes.id).approval_reference).toMatch(/^WhatsApp · /);
  console.log('Enviar y aceptar correctos');

  // Pedir cambios abre una versión con el motivo; «no acepta» parte de la aceptada y conserva el motivo.
  await page.getByRole('button',{name:'Partir de esta versión'}).click();const nueva=page.getByRole('dialog',{name:/Versión nueva desde la V2/});await nueva.getByLabel('Motivo del cambio').fill('Propuesta del recorrido');await nueva.getByRole('button',{name:'Crear la versión nueva'}).click();await expect(nueva).not.toBeVisible();
  await page.getByRole('button',{name:'Enviar V3 al cliente'}).click();await page.getByRole('dialog',{name:'Enviar la V3 al cliente'}).getByRole('button',{name:'Enviar por WhatsApp'}).click();await page.getByRole('dialog',{name:'V3 lista para el cliente'}).getByRole('button',{name:'Hecho'}).click();
  await page.getByRole('button',{name:'Registrar respuesta del cliente'}).click();let dialogo=page.getByRole('dialog',{name:/sobre la V3/});await dialogo.getByRole('radio',{name:/Pide cambios/}).click();await dialogo.getByLabel('Qué pide').fill('Otra tarima');await dialogo.getByRole('button',{name:'Abrir versión con los cambios'}).click();await expect(dialogo).not.toBeVisible();
  estado=await ws(page);expect(estado.versions.find(v=>v.number===4 && v.budget_id===antes.budget_id).change_reason).toContain('Otra tarima');
  await page.getByRole('button',{name:'Enviar V4 al cliente'}).click();await page.getByRole('dialog',{name:'Enviar la V4 al cliente'}).getByRole('button',{name:'Enviar por WhatsApp'}).click();await page.getByRole('dialog',{name:'V4 lista para el cliente'}).getByRole('button',{name:'Hecho'}).click();
  await page.getByRole('button',{name:'Registrar respuesta del cliente'}).click();dialogo=page.getByRole('dialog',{name:/sobre la V4/});await dialogo.getByRole('radio',{name:/No lo acepta/}).click();await dialogo.getByLabel('Motivo').fill('Precio');await dialogo.getByRole('button',{name:'Registrar que no acepta'}).click();await expect(dialogo).not.toBeVisible();
  estado=await ws(page);const quinta=estado.versions.find(v=>v.number===5 && v.budget_id===antes.budget_id);expect(quinta.change_reason).toBe('El cliente no aceptó la V4: Precio');expect(quinta.items.length).toBe(estado.versions.find(v=>v.id===antes.id).items.length);
  await page.getByRole('button',{name:/^Versiones · /}).click();await expect(page.getByText('Se envió y luego se cambió por la V5.')).toBeVisible();
  console.log('Pedir cambios y no aceptar correctos');

  // Obra y cobros.
  await page.getByRole('tab',{name:/^Obra/}).click();await expect(page.getByRole('button',{name:'Nueva tarea'})).toBeVisible();
  await page.getByRole('tab',{name:/^Cobros/}).click();await page.getByRole('button',{name:/^Facturar .*€/}).click();const cobro=page.getByRole('dialog',{name:'Factura'});await expect(cobro.getByLabel('Concepto')).toHaveValue(/Cobro parcial/);await cobro.getByRole('button',{name:'Enviar factura'}).click();
  const anio=new Date().getFullYear();await expect(page.getByRole('dialog',{name:`${anio}-0003`})).toBeVisible();const emitida=page.getByRole('dialog',{name:`${anio}-0003`});await expect(emitida.getByRole('link',{name:'Ver el PDF'})).toBeVisible();
  await emitida.getByRole('button',{name:'Marcar como cobrada'}).click();await expect(emitida.getByText('Cobrada',{exact:true})).toBeVisible();await emitida.getByRole('button',{name:'Deshacer el cobro'}).click();await expect(emitida.getByRole('button',{name:'Marcar como cobrada'})).toBeVisible();await emitida.getByRole('button',{name:'Cerrar'}).click();
  expect((await ws(page)).invoices.find(f=>f.number===`${anio}-0003`).status).toBe('sent');
  await page.getByRole('tab',{name:/^Planos y fotos/}).click();await page.getByRole('button',{name:'Subir',exact:true}).click();const subir=page.getByRole('dialog',{name:'Subir archivos'});
  await subir.getByLabel('Seleccionar archivos',{exact:true}).setInputFiles({name:'visita-de-ejemplo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64')});
  await expect(subir).not.toBeVisible();await expect(page.getByRole('button',{name:'Abrir visita-de-ejemplo.png'})).toBeVisible();
  console.log('Obra, cobros y archivos correctos');

  // Chat flotante: no bloquea la pantalla de debajo y conserva lupa, información y enviar.
  await page.getByRole('button',{name:/^Chat/}).click();const chat=page.getByRole('textbox',{name:'Nuevo mensaje'});await chat.fill('Mensaje del recorrido');await page.keyboard.press('Enter');await expect(page.getByRole('log').getByText('Mensaje del recorrido')).toBeVisible();
  await page.getByRole('button',{name:'Buscar en la conversación'}).click();await page.getByRole('searchbox',{name:'Buscar en la conversación'}).fill('recorrido');await expect(page.getByText('1 mensaje',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Cerrar la búsqueda'}).click();
  await page.getByRole('button',{name:'Adjuntar',exact:true}).click();await expect(page.getByRole('button',{name:'Ubicación de la obra'})).toBeVisible();await page.getByRole('button',{name:'Ubicación de la obra'}).click();await expect(chat).toHaveValue(/google\.com\/maps/);await chat.fill('');
  await page.getByRole('tab',{name:/^Resumen/}).click();await expect(page.getByRole('region',{name:'Últimos movimientos'})).toBeVisible();await expect(chat).toBeVisible();
  await page.getByRole('button',{name:'Cerrar el chat'}).click();await expect(chat).not.toBeVisible();
  console.log('Chat correcto');

  // Catálogo con tolerancia, alta en panel, duplicar y dar de baja.
  await page.goto(`${base}/catalogo`);const cat=page.getByRole('searchbox',{name:'Buscar artículos'});await cat.fill('tarmia');await expect(page.getByRole('button',{name:/Tarima/}).first()).toBeVisible();await expect(page.getByText(/«tarmia» → /)).toBeVisible();await cat.fill('');
  await page.getByRole('button',{name:'Nuevo artículo'}).click();const ficha=page.getByRole('dialog',{name:/Artículo/});await ficha.getByLabel('Nombre').fill('Artículo del recorrido');await ficha.getByRole('button',{name:'Categoría',exact:true}).click();await page.getByRole('option',{name:'Pintura',exact:true}).click();await ficha.getByLabel('Precio sin IVA').fill('12,50');await ficha.getByRole('button',{name:'Guardar'}).click();await expect(ficha).not.toBeVisible();
  await page.getByRole('button',{name:/Artículo del recorrido/}).click();const editar=page.getByRole('dialog',{name:'Artículo del recorrido'});await editar.getByRole('button',{name:'Duplicar'}).click();await expect(editar).not.toBeVisible();await expect(page.getByRole('button',{name:/Artículo del recorrido \(copia\)/})).toBeVisible();
  await page.getByRole('button',{name:/Artículo del recorrido \(copia\)/}).click();const copia=page.getByRole('dialog',{name:/\(copia\)/});await copia.getByRole('button',{name:'Dar de baja'}).click();await copia.getByRole('button',{name:'Sí',exact:true}).click();await expect(copia).not.toBeVisible();
  console.log('Catálogo correcto');

  // Clientes y Finanzas leen lo anterior.
  await page.goto(`${base}/clientes`);await page.getByRole('link',{name:/Cliente de ejemplo 01/}).click();await expect(page.getByRole('heading',{level:1})).toHaveText('Cliente de ejemplo 01');await page.getByRole('tab',{name:/^Facturas/}).click();await expect(page.getByText(/Cobro parcial · \d/)).toBeVisible();
  await page.goto(`${base}/finanzas`);await page.getByRole('button',{name:'Año',exact:true}).click();await expect(page.getByRole('heading',{level:1})).toHaveText('Finanzas');await expect(page.getByText(/Cobro parcial · \d/).first()).toBeVisible();
  await page.getByRole('button',{name:'Vencida',exact:true}).click();await expect(page.getByRole('button',{name:/-0002/})).toBeVisible();await expect(page.getByRole('button',{name:/-0003/})).toHaveCount(0);await page.getByRole('button',{name:'Todas',exact:true}).click();
  await page.getByRole('button',{name:'Nueva factura'}).first().click();const nuevaF=page.getByRole('dialog',{name:'Factura'});await expect(nuevaF.getByRole('button',{name:'Enviar factura'})).toBeDisabled();await nuevaF.getByRole('button',{name:'Proyecto',exact:true}).click();await page.getByRole('option',{name:/Vivienda en Monte Alto/}).click();await nuevaF.getByLabel('Concepto').fill('Factura del recorrido');await nuevaF.getByLabel('Base').fill('1.000,00');await expect(nuevaF.getByText('1.210,00 €')).toBeVisible();await nuevaF.getByRole('button',{name:'Guardar borrador'}).click();await expect(nuevaF).not.toBeVisible();
  await page.getByRole('button',{name:/Borrador.*Factura del recorrido/}).click();const borrador=page.getByRole('dialog',{name:'Factura'});await borrador.getByRole('button',{name:'Eliminar'}).click();await borrador.getByRole('button',{name:'Sí',exact:true}).click();await expect(borrador).not.toBeVisible();
  await page.goto(`${base}/finanzas?factura=${id(601)}`);await expect(page.getByRole('dialog',{name:`${anio}-0002`})).toBeVisible();await page.goto(`${base}/finanzas`);await page.getByRole('button',{name:'Año',exact:true}).click();
  const pdf=(await ws(page)).invoices.find(f=>f.number===`${anio}-0003`).id;
  const [descarga]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Exportar para la gestoría'}).click()]);expect(descarga.suggestedFilename()).toBe('facturas-para-la-gestoria.csv');
  await page.goto(`${base}/imprimir/factura/${pdf}`);await expect(page.getByText(`${anio}-0003`)).toBeVisible();await expect(page.getByText('No sustituye a la factura oficial',{exact:false})).toBeVisible();
  console.log('Clientes y Finanzas correctos');

  // Agenda de calendario: cuatro vistas y minicalendario, sin horas inventadas.
  await page.goto(`${base}/agenda`);await expect(page.getByRole('button',{name:'Semana',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Mes',exact:true}).click();await expect(page.getByRole('grid')).toBeVisible();
  await page.getByRole('button',{name:'Lista',exact:true}).click();await expect(page.getByText(/Replantear tabiquería/).first()).toBeVisible();
  await page.getByRole('button',{name:'Día',exact:true}).click();await page.getByRole('button',{name:/Replantear tabiquería/}).first().click();const cita=page.getByRole('dialog',{name:'Tarea'});await expect(cita.getByRole('link',{name:'Abrir proyecto'})).toBeVisible();await cita.getByRole('button',{name:'Cerrar'}).click();
  console.log('Agenda correcta');

  // Avisos: una mención al usuario sube el contador del aro y se marca como leída.
  await page.goto(url);await page.getByRole('button',{name:/^Chat/}).click();
  await page.evaluate(id=>{const w=JSON.parse(localStorage.getItem('plano.workspace.v1'));w.messages.push({id:'00000000-0000-4000-8000-000000009999',organization_id:w.organization_id,project_id:id,body:'@Alex mañana nos quedamos sin placa',author_name:'Dani · Demo',created_at:new Date().toISOString()});localStorage.setItem('plano.workspace.v1',JSON.stringify(w));},project);
  await page.goto(`${base}/`);const cuenta=page.getByRole('button',{name:/^Tu cuenta.*avisos sin leer/}).first();await expect(cuenta).toBeVisible();await cuenta.click();await expect(page.getByText('te ha mencionado en Vivienda en Monte Alto')).toBeVisible();await page.getByRole('button',{name:'Marcar todo como leído'}).click();await expect(page.getByRole('button',{name:/avisos sin leer/})).toHaveCount(0);
  await page.getByRole('heading',{level:1}).click();
  console.log('Avisos correctos');

  // Móvil: barra con «+» central, hoja de cuenta, apartados de la ficha y barra fija del presupuesto.
  await page.setViewportSize({width:390,height:844});
  await page.goto(`${base}/`);await page.getByRole('navigation',{name:'Principal'}).getByRole('button',{name:'Crear'}).click();await expect(page.getByRole('dialog',{name:'Crear'}).getByRole('menuitem',{name:/^Tarea/})).toBeVisible();await page.keyboard.press('Escape');
  await page.getByRole('button',{name:/^Tu cuenta/}).click();await page.getByRole('button',{name:'Tu cuenta',exact:true}).click();await expect(page.getByRole('group',{name:'Tema de la interfaz'})).toBeVisible();await page.keyboard.press('Escape');
  const otro=id(11);await page.goto(`${base}/proyectos/${otro}`);await expect(page.getByRole('navigation',{name:'Apartados del proyecto'})).toBeVisible();await expect(page.getByRole('navigation',{name:'Principal'})).toBeVisible();await expect(page.getByRole('link',{name:'Inicio'}).locator('visible=true')).toHaveCount(1);await expect(page.getByRole('tablist',{name:'Secciones del proyecto'})).not.toBeVisible();
  await page.getByRole('button',{name:/^Presupuesto/}).first().click();await expect(page.getByRole('button',{name:/^Enviar V\d+ al cliente/})).toBeVisible();await expect(page.getByRole('navigation',{name:'Principal'})).not.toBeVisible();
  await page.getByRole('button',{name:'Añadir',exact:true}).click();const hoja=page.getByRole('dialog',{name:'Añadir del catálogo'});await expect(hoja.getByRole('link',{name:'Plano'})).toBeVisible();await hoja.getByRole('button',{name:'Cerrar'}).click();
  console.log('Composición móvil correcta');
  for(const ruta of ['/','/proyectos',`/proyectos/${project}`,`/proyectos/${project}?s=budget`,'/agenda','/clientes','/catalogo','/finanzas','/ajustes','/mas']){await page.goto(base+ruta);await page.waitForTimeout(400);const sobra=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);expect(sobra,`Scroll horizontal en ${ruta}`).toBeLessThanOrEqual(0);}
  await page.screenshot({path:path.join(out,'mas-390.png')});
  console.log('Móvil correcto');
  if(errors.length)throw new Error(`Errores de navegador: ${errors.join(' | ')}`);
  console.log('Recorrido completo sin errores');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
