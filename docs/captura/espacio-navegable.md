# Espacio navegable y catálogo · prototipo

Ruta: `/laboratorio/espacio`, en la rama aislada de captura. Incluye un local y una nave sintéticos; ningún espacio se ha reconstruido desde imágenes de GARAL. Los artículos, modelos y precios son ficticios. El requisito es general: vivienda, nave, oficina, local u otro inmueble, con geometría inicial procedente de fotos, captura métrica y/o planos según los datos disponibles.

## Qué permite comprobar

El prototipo presenta geometría 3D sencilla, con vista general abierta y puntos de vista dentro del espacio. Se puede girar/acercar con ratón o gestos y usar botones equivalentes; seleccionar suelo, paredes o equipamiento desde la escena o la lista; y elegir una alternativa del catálogo. No hay navegación libre con colisiones ni una reconstrucción fotográfica completa.

Cambiar el suelo, acabado de pared o mueble modifica su representación y la partida vinculada. La cantidad sigue procediendo de una medición declarada del ejemplo. Las unidades de mobiliario no se calculan contando mallas: una estantería puede tener muchas piezas y un objeto existente puede estar dibujado sin venderse. Un desajuste entre unidades declaradas e instancias de mobiliario se señala para revisión, sin corregir la factura por la apariencia de la escena.

El resumen distingue base, IVA, total y diferencia frente a las elecciones iniciales, en base sin IVA. Conserva una instantánea inicial de comparación y permite restaurarla con confirmación. Las elecciones de un ejemplo se conservan al visitar el otro. La demostración no tiene una revisión aprobada vinculada y no cambia ningún presupuesto real.

El presupuesto incluye también protección/preparación sin objeto 3D, como partida manual de ejemplo con importe explícito. La futura composición de actuaciones podrá sustituirla por trabajos del catálogo. Los artículos de muestra ya incorporan el montaje/aplicación indicado en su nombre: no se vuelve a añadir como instalación separada. Las cajas de las estanterías y la columna existente son contexto visual, sin partidas adicionales.

La descarga genera una propuesta JSON con escena sintética, selección, recursos visuales elegidos, vínculos artículo-medición-partida e instantáneas económicas. No es un presupuesto formal ni persiste en Supabase. La descarga no se importa aún desde la interfaz.

## Contrato de desarrollo

- `src/lib/visual/schema.ts`: escena con dimensiones, mediciones, elecciones, objetos y trabajos sin representación; recursos visuales con artículo, revisión y dimensiones del modelo de ejemplo. La versión actual admite únicamente origen sintético y recursos procedurales genéricos.
- `src/lib/visual/pricing.ts`: cálculo puro contra un catálogo y organización explícitos. Valida recursos permitidos, unidades, identidad de partidas y tipo de representación. Devuelve partidas con IDs estables, vínculos a la medición y avisos. No constituye por sí solo una autorización del servidor.
- `src/lib/visual/viewer.ts`: representación con Three.js, independiente de los precios. Crea muebles/estanterías con primitivas y materiales procedurales. No contiene un lector de GLB, IFC, E57 o CAD. Los colores RGB del recurso son contenido de la escena; la interfaz y las superposiciones usan tokens.
- `src/lib/visual/demo.ts`: ejemplos ficticios y tarifas de prueba. No sustituye al catálogo de GARAL.

La vista carga el motor 3D bajo demanda. Renderiza al cambiar la cámara, tamaño, selección o material, sin bucle continuo; limita densidad de píxeles y libera controles, geometría, materiales y texturas al desmontar. Si WebGL no está disponible, se puede seguir consultando artículos y diferencias económicas.

Las tarifas nuevas no alteran una instantánea ya devuelta por el motor. La conexión futura a un presupuesto deberá usar el contrato transaccional de revisiones y la evidencia guardada; el resumen local no representa un presupuesto aprobado ni permite publicarlo al cliente.

## Pruebas

Pruebas de cálculo con `npm test -- tests/visual`: cantidades independientes de mallas, variantes y diferencias, instantánea anterior, trabajos sin objeto, aislamiento por organización, unidades incompatibles e identificadores duplicados.

Prueba de navegador con `node tests/visual/space.browser-check.cjs`, después de arrancar el servidor en 3117. Admite `PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` y `PLANO_BROWSER_OUTPUT`. En entornos de prueba sin GPU se puede establecer `PLAYWRIGHT_SOFTWARE_WEBGL=1`; solo cambia la configuración del navegador de pruebas, no la aplicación.

Comprueba el visor, puntos de vista, cambio de suelo/mueble con diferencias, descarga, conservación de elecciones entre espacios, restauración, tres anchuras con ambos temas y el modo sin WebGL. Las capturas se guardan en `test-results/espacio` por defecto, fuera del código versionado.

## Siguiente conexión

El espacio existente se obtendrá de fuentes identificadas (planos, fotos y captura con medidas), y la propuesta incorporará las actuaciones solicitadas por GARAL. Faltan importación/reconstrucción, verificación espacial, modelos reales del catálogo, persistencia por revisión, permisos del proyecto y publicación seleccionada en el portal del cliente. El objetivo final es preparar automáticamente la propuesta y presentar las dudas al profesional, no trasladar a Hugo tareas de medición o modelado.

Referencias de implementación: [Three.js](https://threejs.org/docs/) y [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html).
