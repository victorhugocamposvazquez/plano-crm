# Continuidad de desarrollo autónomo · PLANO/GARAL

Hugo ha autorizado el 28/10/2026 continuar unas horas sin esperarle, trabajando PDFs, fotos iniciales de teléfono, futuras cámaras 360, cálculo del catálogo e intercambio de artículos en estancias. La continuación `plano-avanzar-presupuestador-durante-tres-horas` terminó su plazo a las 18:30 UTC (19:30 Madrid) y está PAUSADA. Hugo ha pedido continuar manualmente después del plazo; no reactivar la programación sin una nueva petición. No confundir este plazo con un presupuesto de ejecución o con garantías de precisión.

## Entorno

- Checkout de Codex: `/private/tmp/plano-codex-captura`. Especificar siempre como `workdir`; la antigua carpeta `refocrma` del contexto del chat ya no existe.
- Rama actual: `codex/presupuesto-estancias`, sobre `codex/lectura-pdf-directa` (c5d77cd, PR #40 abierta) y `codex/fiabilidad-presupuestador` (8019d60, PR #39 abierta). Ninguna fusionada por Codex. La base es `main` 8535eff. Las PR 37/38 de Fable y nuestra captura/visor ya están incorporadas en esa base.
- Checkout de Fable: `/Users/hugocamposvazquez/PROYECTOS PROPIOS/PLANO.`. No escribir allí ni cambiar su rama.
- Git metadata del worktree apunta a la carpeta del checkout de Fable; los comandos de commit/push pueden necesitar permiso de sandbox. `gh` ya está autenticado en el llavero y SSH funciona. No mostrar secretos.
- Servidor local activo en 3117 desde este checkout. Un segundo `next dev` del mismo directorio no arranca; usar el existente o `next start` tras build en otro puerto. No correr build y comprobaciones de navegador a la vez.
- Para Playwright usar `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'`. El Chromium empaquetado no está instalado. Producción local de prueba activa en 3119 (`npm run start -- --port 3119`). Si se recompila hay que reiniciar esa instancia para que use los nuevos manifiestos. Para el visor se puede añadir `PLAYWRIGHT_SOFTWARE_WEBGL=1` si no hay GPU, pero la carga con HDRI aún necesita verificación de rendimiento.

## Incremento de fiabilidad entregado (PR #39)

Escala compartida con confirmación ligada a archivo/página/medida; superficies conjuntas con `length_ids`/`faces`, huecos por estado, sin redondeos previos por pared; no omitir trabajos pendientes ni planos sin escala; decisiones expresas para sustituir partidas, diferencia económica efectiva y PDF duplicado evitado. Detalles en `fiabilidad-planos.md`.

Último `npm run check`: 222 pruebas, 34 archivos y compilación correctos. Prueba de navegador `tests/plan/flow.browser-check.cjs` completada sin errores sobre la compilación de producción local en 3119: usa solo datos sintéticos y comprueba guardado, aprobado intacto, escala, huecos y seis combinaciones de ancho/tema. Cantidades guardadas: 9,4 / 4,24 / 8,48 m². Se aisló un bloqueo al precargar rutas del armazón: sus enlaces y los de salida del flujo llevan ahora `prefetch={false}`; no se interceptan peticiones en la prueba final. La página de planos utiliza una instantánea de hidratación para mantener el mismo estado inicial en servidor y navegador. Commit 8019d60, PR #39 adjunta al chat, CI y Vercel correctos; no fusionar automáticamente.

## Siguientes incrementos prioritarios

1. Lectura directa del PDF entregada en #40 con `pdfjs-dist@6.4.299`. El navegador extrae trazos usando un trabajador local, calcula SHA256 del original y lo guarda/vincula mediante `upload`, sin pedir JSON al usuario. Documentación en `lectura-pdf-directa.md`. CI, lector Python y Vercel correctos. Pendiente aún la persistencia de extracción/borrador/evidencia en servidor; no confundir este adaptador local con un servicio asíncrono terminado.
2. Captura por estancia con teléfono: originales, asociación de fotos a estancia y fase, alcance dictado o elegido, referencia métrica independiente cuando falte, preguntas de incertidumbre y propuesta del catálogo. Preparar un contrato de análisis multimodal con datos sintéticos si no hay credenciales; no anunciar análisis real si no se ha ejecutado. Las fotos normales y 360 no proporcionan metros por sí solas.
3. Panorámicas 360: formato equirectangular y orientación para recorrido fotográfico, manteniendo referencias métricas separadas. Después integrar exportaciones con profundidad de equipos profesionales, sin llamar métrica a una simple cámara 360.
4. Catálogo visual: modelos/materiales con revisión y dimensiones verificables, ligados al mismo artículo y precio; seleccionar/intercambiar dentro de cada estancia sin cambiar cantidades por apariencia ni cobrar contexto. Ya hay prototipo `/laboratorio/espacio` con ejemplos sintéticos y PBR local CC0. No hay loader GLB, reconstrucción de fotos ni vínculo persistido a revisión de presupuesto.
5. Evidencia, borradores y revisiones: trazabilidad de mediciones en servidor y no solo localStorage, revisión humana de dudas, aprobación inmutable. Separar estimación inicial para cualificar al cliente del presupuesto técnico validado.

## Materiales reales de GARAL

Privados en `/private/tmp/plano-garal-ejemplos` (inventario) y extracciones en `/private/tmp/plano-captura-validacion`. 31 PDF de planos vectoriales de 10 expedientes; 35 documentos de presupuesto que incluyen versiones, sin costes finales de obra como verdad de referencia. La prueba previa verificó extracción/representación, no precisión de 31 presupuestos. No copiarlos al repositorio ni enviarlos a servicios externos.

No hay catálogo real de precios estructurado ni levantamientos con profundidad en lo recibido. Hay vídeos y PDF. No inventar tarifas comerciales, metros verificados ni porcentajes de confianza. Usar ejemplos ficticios para demostraciones.

## Límites de autorización

Se pueden implementar, probar, hacer commits/push y crear PRs. Mantener coordinación por `docs/PREGUNTAS.md`, respetar el trabajo de Fable y sus pantallas. No fusionar `main`, importar clientes en producción, ejecutar migraciones de producción ni contratar servicios de pago sin autorización específica. No pedir aclaraciones rutinarias mientras Hugo está ausente; avanzar en lo independiente y documentar los bloqueos reales. Informar solo de avances significativos, errores o decisiones necesarias.

## Lectura PDF directa · estado actual

PDF.js 6.4.299 instalado y fijado en package-lock; Node >=22.13 y <25. `predev`/`prebuild` copian trabajador y licencia a `public/pdfjs/` (generado e ignorado). No usa CDN ni servicios de análisis. El original sí se guarda en el almacenamiento habitual del CRM. `upload` ahora devuelve el `Document` creado, sin inferir su identidad por nombre.

Adaptador conservador: transformaciones, rotación, capas visibles, color, recortes rectangulares. Omite curvas, rellenos compuestos, patrones/efectos y recortes no interpretables; no mide píxeles de imágenes. Límites: 50 MB, 20 páginas, 45 segundos para operaciones asíncronas, límites de trazos/operadores/contornos. No sustituye validación técnica ni detecta todas las partidas.

Prueba local privada de los 31 PDF de GARAL correcta: 63.879 trazos lineales emitidos, 3.230 contornos curvos y 174 rellenos compuestos omitidos explícitamente. Todos quedan como lectura parcial. Estos resultados describen extracción, NO 31 presupuestos validados. Informe privado en `/private/tmp/plano-pdfjs-validacion.json`, fuera del repositorio.

Verificación: `npm run check` correcto (232 pruebas + una privada omitida, tipos y build); después de añadir el caso de imagen incrustada, `npm test` correcto con 233 pruebas + una privada omitida. Recorrido móvil PDF correcto: trabajador local, SHA, documento vinculado, relectura sin duplicar y PDF sin geometría pendiente, sin errores. Regresión completa del flujo correcta en 390/768/1280 y ambos temas: 9,4 / 4,24 / 8,48 m², aprobado intacto, decisiones expresas. Captura revisada en `test-results/pdf-directo/pdf-leido-390.png` (ignorada).

## Motor por estancias · entrega siguiente

`src/lib/captura/room-survey.ts` + `POST /api/estimaciones/estancias`: contrato de fuentes/fotos/panoramas, medidas, preguntas y selecciones de catálogo por estancia. Separación de cantidades entre zonas, cambio inmutable de artículo, bloqueo de unidad incompatible y contexto visual excluido de coste. Exige documentos visuales del proyecto y catálogo autorizado. No ejecuta análisis de imágenes, no persiste captura/procedencia ni cambia pantallas. Integración con visita y servidor pendiente; detalle en `estancias-catalogo.md`.

`npm run check` correcto: 253 pruebas + una privada omitida, tipos y build. Commit ea3fadb, PR #41 basada en #40, adjunta al chat. No hay migraciones nuevas ni acciones de producción. Siguiente incremento: integrar la captura por estancias en el flujo de visita y persistir captura/procedencia con concurrencia; no anunciar todavía análisis de imágenes ni sincronización entre dispositivos.

## 29/10/2026 · cambio de foco autorizado por Hugo

Hugo ha pedido un rediseño amplio por exceso de información y dificultad para entender versiones/cambios, además de documentación privada del producto para superadministración. Rama de interfaz `codex/usabilidad-presupuestos`, basada en 19e2f0f / #41, sin modificar el checkout de Fable ni fusionar main. Primera entrega: Resumen separado de Presupuesto/Obra/Documentos/Compras, selector libre e historial, comparación de partidas y condiciones, editor progresivo y legibilidad. `budgetHistory` evita cerradas históricas pendientes y los avisos/siguientes pasos identifican su presupuesto. Criterios en `docs/usabilidad/README.md`.

Trabajo paralelo de documentación terminado en archivos nuevos `sistema/**`: allowlist de UUID server-only, sesión real, sin acceso demo; documentación editorial de capacidades/cambios y corrección supervisada todavía como procedimiento, sin monitorización ni aplicación automática. Se publicará en otra PR basada en la de interfaz. No se ha configurado la allowlist ni alterado producción.

Comprobación integrada actual: 281 pruebas + una privada omitida, tipos y build correctos. Recorrido de presupuesto con datos sintéticos cubre 390/768/1280, ambos temas, condiciones sin cambio de precio, selección histórica, nueva revisión y aprobado intacto; repetido y correcto tras las últimas correcciones del editor, sin errores. La regresión desde planos también pasa. No recompilar mientras los navegadores usan esa instancia; reiniciar `next start` después de cada build. Separar commits/PR de usabilidad y supervisión, adjuntar ambas al chat. La continuación por horas sigue pausada; no reactivarla por este cambio de foco.

Actualización de integración: `origin/main` 7bd924a incluye la PR #39 (fusionada externamente). #40 y #41 siguen abiertas; el rediseño se entrega sobre #41. No se ha fusionado ninguna entrega desde este chat.
