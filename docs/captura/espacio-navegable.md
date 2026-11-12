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

## Propuesta en 3D dentro del proyecto (5 nov 2026)

Ruta: `/proyectos/[id]/espacio3d`, desde el menú del proyecto («Propuesta en 3D») y desde «Añadir al presupuesto». Usa el mismo visor (`src/lib/visual/viewer.ts`) con el local o la nave de ejemplo, pero con los **artículos del catálogo** de la empresa en lugar de los ficticios:

- Suelo: artículos en m² de pavimento, tarima, porcelánico, resina…; paredes: pintura, revestimiento, alicatado; mobiliario: armarios, muebles y estanterías en ud. La textura se elige por el nombre (`aspecto` en `src/lib/espacio3d.ts`); el color, por voz o con las muestras.
- Órdenes por voz (`src/lib/voz.ts`, la misma que la visita 360), escritas o tocando la escena: «pon porcelánico en el suelo», «pinta las paredes de verde salvia», «pon dos estanterías», «el mueble en nogal», «mide 6 por 4 y 3 de alto», «vamos a la nave», «entra», «gira a la izquierda», «¿cuánto va?», «deshaz», «pásalo al presupuesto».
- Cantidades: suelo = largo × ancho; paredes = perímetro × alto, menos la ventana de 3 m² que dibuja el local; mobiliario = unidades dichas (se dibujan las que caben en la pared del fondo). Nunca se cuentan mallas.
- «Pasar al presupuesto» añade las partidas al borrador con `budget.create` / `budget.revise` / `budget.save`, como la visita 360. Sin comandos nuevos ni migraciones; lo elegido se recuerda en el navegador (`plano.espacio3d.<proyecto>`).

Pruebas: `tests/espacio3d.test.ts`.

### Almacén en la propuesta 3D

Si el artículo elegido se guarda en la nave (`stocked`), cada alternativa dice cuánto queda libre y el ticket avisa de lo que falta pedir («Por pedir»). Libre = existencias menos lo recibido para otras obras y aún no llevado (`estadoStock` de `src/lib/stock.ts`). Por voz: «¿hay stock?», «¿cuánto queda de porcelánico?». Pasar al presupuesto no reserva ni descuenta existencias: eso sigue pasando con los pedidos de Materiales ligados al artículo.

### Pedir lo que falta

En «Por pedir», cada artículo tiene «Pedir»: apunta un pedido en Materiales del proyecto, ligado al artículo del catálogo (`purchase.create` con `article_id`), con la cantidad que falta y el último proveedor usado para ese artículo. Lo ya pedido para esta obra y aún no recibido se descuenta (`enCamino`). Por voz: «pide lo que falta». Al recibir el pedido entra en el almacén; al llevarlo a obra sale.

## Plano en 3D: una planta entera con su instalación (12 nov 2026)

Ruta: `/proyectos/[id]/planta3d`, desde el menú del proyecto («Plano en 3D») y desde «Añadir al presupuesto». A diferencia de la propuesta en 3D, que es una caja, aquí se levanta la planta completa: cada recinto a su altura, con el suelo del color de su uso térmico, los equipos y el trazado de tuberías.

- **Datos:** `src/lib/planta-ejemplo.ts` es una nave frigorífica real sin nombres de cliente. Superficie, altura y temperatura son las rotuladas; contornos, equipos y tuberías salen de los trazos del PDF, en puntos, con la escala deducida de las superficies de las cámaras. Los rótulos están transcritos a mano: Plano no los lee todavía (ver `docs/PREGUNTAS.md`).
- **Cantidades:** evaporadores por modelo en unidades; tubería en metros por diámetro, medida sobre el trazado en planta (`medicionTuberia`), sin bajadas ni subida a la central; una central. Los ramales solo cuentan si su equipo está puesto. Los tramos con rótulo dudoso se listan para confirmar.
- **Catálogo:** capítulo «Refrigeración». El evaporador se empareja por la referencia que lleva el nombre del artículo (`TEWSDC45`), la tubería por el diámetro (`1 3/8`) y la central por la palabra. Sin artículo o con precio 0 la partida sale como «Precio pendiente» y queda fuera del total; nunca se inventa una cifra. Los artículos de la demostración van a 0 y no se cargan con los proyectos de ejemplo.
- **Órdenes** (voz, escritas o tocando): «pon lo del plano», «pon dos evaporadores en la cámara 3», «un TEWSDC45 en muelles», «cambia el BT09 por un TEWSSC80-4», «quita el MT04», «quita la tubería», «¿qué lleva la cámara 2?», «¿cuántos metros de aspiración de baja?», «entra en la cámara 2», «vista general», «¿cuánto va?», «deshaz», «pásalo al presupuesto».
- **Visor:** `src/lib/visual/planta-viewer.ts`, con Three.js bajo demanda y pintado solo cuando cambia algo. Lo presupuestado se ve macizo; lo que marca el plano y falta, en silueta. La altura de las tuberías no viene en el plano: se dibujan bajo el techo.
- Lo elegido se recuerda en el navegador (`plano.planta3d.<proyecto>.<planta>`) y pasa al borrador con `budget.create` / `budget.revise` / `budget.save`. Sin comandos nuevos ni migraciones.

Pruebas: `tests/planta3d.test.ts`.

### Subir un plano y verlo convertirse (12 nov 2026)

«Subir un plano» lee un PDF en el navegador y levanta su planta. Hugo pidió que lo hiciera Plano y, por ahora, solo con planos que traen texto.

- **Lectura:** `src/lib/planta-lector-pdf.ts` saca textos y trazos rectos de la primera hoja con PDF.js (sin el tope de 250.000 operadores de la lectura rápida: estas plantas pasan del millón). `src/lib/planta-lector.ts` hace el resto, sin dependencias: rótulos con «S: … m²» (nombre, «h:», «Tª:») son recintos; «EQUIPO BT01» con el modelo debajo, equipos; «CO2 A_BT = Ø1 3/8"», diámetros.
- **Contornos y escala:** se rellena el hueco entre muros alrededor de cada rótulo. Qué grises son muro se decide probando: gana la combinación que más recintos hace cuadrar con su superficie rotulada, y de ahí sale la escala. Cada recinto queda como medido (cuadra a menos del 6 %), aproximado (contorno de los muros, pero se desvía) o estimado (los muros no cierran: cuadrado con la superficie rotulada).
- **Equipos y tuberías:** el símbolo es el grupo compacto de trazos de color más cercano al rótulo; las tuberías, las corridas largas de color. El circuito sale del color (azul, rosa, verde, rojo) y el diámetro del rótulo más cercano que nombra ese circuito. Es una convención de estos planos y la pantalla lo avisa. La leyenda del plano queda fuera.
- **Sin texto:** si el PDF no trae texto (impreso con «Print to PDF», escaneado) se avisa y no se convierte.
- **Conversión:** mientras se lee, `escaner-plano.tsx` pinta el plano una vez en un lienzo 2D con aspecto de cámara térmica y un haz en CSS lo recorre. Al terminar, el visor (`convertir`) parte de la planta vista desde arriba, levanta los muros mientras inclina la cámara, baja los equipos y vuelve a los colores normales. Unos 5 s, sin postproceso ni librerías nuevas. «Ver la conversión» la repite.
- **Revisión:** «Leído del plano, por revisar» lista avisos y cómo se midió cada recinto. La planta leída se guarda en el navegador (`plano.planta3d.subida.<proyecto>`); persistirla en el servidor es de Codex.

En el plano de la nave frigorífica: 27 recintos (15 medidos, 5 aproximados, 7 estimados, casi todos aseos y despachos con mobiliario), 14 equipos con su modelo y unos 466 m de tubería. La escala sale 0,1505 m por punto, un 0,7 % por encima de la calculada a mano.

Pruebas: `tests/planta-lector.test.ts` (plano sintético; el PDF real no se copia al repositorio).

### Precios orientativos y referencia al plano (12 nov 2026)

Hugo pidió precios orientativos para poder presupuestar. Los 14 artículos del capítulo «Refrigeración» (`src/lib/demo.ts`) llevan ahora un precio estimado por Claude, no una tarifa: en internet solo hay públicas tarifas de accesorios K65 y de equipos pequeños. En una empresa real, «Plano en 3D» ofrece «Añadir al catálogo» cuando faltan (un `article.create` por artículo); no entran con los proyectos de ejemplo. Al pasar la propuesta al presupuesto, las notas de la versión quedan referenciadas al plano y avisan de que los precios son orientativos.

### Conversión cinematográfica y tuberías a la vista (12 nov 2026, noche)

Hugo no veía los tubos y pidió una conversión más de cine. Las tuberías van ahora gruesas a propósito y una al lado de otra dentro de su haz (`carril` en `EscenaTubo`), a la misma altura, para que se distingan desde arriba; lo no presupuestado sigue translúcido. La conversión dura unos 9 s y es un plano secuencia: cámara cerca y en vertical que sube en espiral, rejilla de suelo, haz y dos ondas, muros que crecen como nube de puntos de escáner con el canto encendido, tuberías que se trazan en orden, equipos que caen y un destello al volver al papel. Encima, bandas de cine, viñeta y títulos grandes con las cifras de la planta. Sigue sin postproceso ni librerías nuevas, y con «reducir movimiento» no se anima.

