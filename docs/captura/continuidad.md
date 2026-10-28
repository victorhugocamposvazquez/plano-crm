# Continuidad de desarrollo autónomo · PLANO/GARAL

Hugo ha autorizado el 28/10/2026 continuar unas horas sin esperarle, trabajando PDFs, fotos iniciales de teléfono, futuras cámaras 360, cálculo del catálogo e intercambio de artículos en estancias. Hay una continuación de este chat programada hasta las 18:30 UTC (19:30 Madrid), con id `plano-avanzar-presupuestador-durante-tres-horas`. No confundir este plazo con un presupuesto de ejecución o con garantías de precisión.

## Entorno

- Checkout de Codex: `/private/tmp/plano-codex-captura`. Especificar siempre como `workdir`; la antigua carpeta `refocrma` del contexto del chat ya no existe.
- Rama actual: `codex/fiabilidad-presupuestador`, creada sobre `main` 8535eff tras actualizar desde GitHub. Las PR 37/38 de Fable y nuestra captura/visor ya están incorporadas en esa base.
- Checkout de Fable: `/Users/hugocamposvazquez/PROYECTOS PROPIOS/PLANO.`. No escribir allí ni cambiar su rama.
- Git metadata del worktree apunta a la carpeta del checkout de Fable; los comandos de commit/push pueden necesitar permiso de sandbox. `gh` ya está autenticado en el llavero y SSH funciona. No mostrar secretos.
- Servidor local activo en 3117 desde este checkout. Un segundo `next dev` del mismo directorio no arranca; usar el existente o `next start` tras build en otro puerto. No correr build y comprobaciones de navegador a la vez.
- Para Playwright usar `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'`. El Chromium empaquetado no está instalado. Producción local de prueba activa en 3119 (`npm run start -- --port 3119`). Si se recompila hay que reiniciar esa instancia para que use los nuevos manifiestos. Para el visor se puede añadir `PLAYWRIGHT_SOFTWARE_WEBGL=1` si no hay GPU, pero la carga con HDRI aún necesita verificación de rendimiento.

## Incremento en curso

Escala compartida con confirmación ligada a archivo/página/medida; superficies conjuntas con `length_ids`/`faces`, huecos por estado, sin redondeos previos por pared; no omitir trabajos pendientes ni planos sin escala; decisiones expresas para sustituir partidas, diferencia económica efectiva y PDF duplicado evitado. Detalles en `fiabilidad-planos.md`.

Último `npm run check`: 222 pruebas, 34 archivos y compilación correctos. Prueba de navegador `tests/plan/flow.browser-check.cjs` completada sin errores sobre la compilación de producción local en 3119: usa solo datos sintéticos y comprueba guardado, aprobado intacto, escala, huecos y seis combinaciones de ancho/tema. Cantidades guardadas: 9,4 / 4,24 / 8,48 m². Se aisló un bloqueo al precargar rutas del armazón: sus enlaces y los de salida del flujo llevan ahora `prefetch={false}`; no se interceptan peticiones en la prueba final. La página de planos utiliza una instantánea de hidratación para mantener el mismo estado inicial en servidor y navegador. Subir una PR pequeña y adjuntarla al chat después de crearla; no fusionar automáticamente.

## Siguientes incrementos prioritarios

1. Lectura directa del PDF. El flujo de Fable todavía sube el PDF pero requiere importar el JSON de `scripts/captura/extract_pdf.py`. Hace falta un adaptador de procesamiento y extracción persistida vinculada a SHA256/documento, con permisos y límites. Evaluar un lector JS ejecutable en el stack actual o un trabajador Python asíncrono; no ejecutar Python como si Vercel Node lo incluyera. Reutilizar el esquema `PdfExtraction` y verificar contra las 31 extracciones de GARAL que ya existen localmente. Una imagen escaneada debe quedar pendiente de OCR/medida, sin fingir lectura vectorial.
2. Captura por estancia con teléfono: originales, asociación de fotos a estancia y fase, alcance dictado o elegido, referencia métrica independiente cuando falte, preguntas de incertidumbre y propuesta del catálogo. Preparar un contrato de análisis multimodal con datos sintéticos si no hay credenciales; no anunciar análisis real si no se ha ejecutado. Las fotos normales y 360 no proporcionan metros por sí solas.
3. Panorámicas 360: formato equirectangular y orientación para recorrido fotográfico, manteniendo referencias métricas separadas. Después integrar exportaciones con profundidad de equipos profesionales, sin llamar métrica a una simple cámara 360.
4. Catálogo visual: modelos/materiales con revisión y dimensiones verificables, ligados al mismo artículo y precio; seleccionar/intercambiar dentro de cada estancia sin cambiar cantidades por apariencia ni cobrar contexto. Ya hay prototipo `/laboratorio/espacio` con ejemplos sintéticos y PBR local CC0. No hay loader GLB, reconstrucción de fotos ni vínculo persistido a revisión de presupuesto.
5. Evidencia, borradores y revisiones: trazabilidad de mediciones en servidor y no solo localStorage, revisión humana de dudas, aprobación inmutable. Separar estimación inicial para cualificar al cliente del presupuesto técnico validado.

## Materiales reales de GARAL

Privados en `/private/tmp/plano-garal-ejemplos` (inventario) y extracciones en `/private/tmp/plano-captura-validacion`. 31 PDF de planos vectoriales de 10 expedientes; 35 documentos de presupuesto que incluyen versiones, sin costes finales de obra como verdad de referencia. La prueba previa verificó extracción/representación, no precisión de 31 presupuestos. No copiarlos al repositorio ni enviarlos a servicios externos.

No hay catálogo real de precios estructurado ni levantamientos con profundidad en lo recibido. Hay vídeos y PDF. No inventar tarifas comerciales, metros verificados ni porcentajes de confianza. Usar ejemplos ficticios para demostraciones.

## Límites de autorización

Se pueden implementar, probar, hacer commits/push y crear PRs. Mantener coordinación por `docs/PREGUNTAS.md`, respetar el trabajo de Fable y sus pantallas. No fusionar `main`, importar clientes en producción, ejecutar migraciones de producción ni contratar servicios de pago sin autorización específica. No pedir aclaraciones rutinarias mientras Hugo está ausente; avanzar en lo independiente y documentar los bloqueos reales. Informar solo de avances significativos, errores o decisiones necesarias.

PDF.js evaluado inicialmente: paquete oficial `pdfjs-dist@6.4.299`, Node >=22.13 o >=24, descargado a `/private/tmp/pdfjs-dist-6.4.299.tgz` y extraído en `/private/tmp/plano-pdfjs-inspect/package`. Todavía NO instalado en el proyecto. API `getOperatorList` con `OPS.constructPath`: argumentos `[paintOp, [Float32Array], bbox]`; `DrawOPS` 0=moveTo, 1=lineTo, 2=cubic, 3=quadratic, 4=closePath. Revisar `build/pdf.mjs` (`makePathFromDrawOPS`, `constructPath`, transform/save/restore y form XObjects). No interpretar curvas como segmentos rectos ni contar cajas envolventes como superficies. Es alternativa potencial al trabajador Python para ejecutar lectura en el stack actual; probar con los PDF reales localmente antes de cambiar el flujo.
