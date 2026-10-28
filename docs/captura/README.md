# Captura y propuesta de presupuesto · primera entrega

Estado: módulo de cálculo y contrato HTTP implementados en `codex/captura-presupuesto`, desde `bea31d6`. El lector PDF se ejecuta localmente con Python. La pantalla de visita existente sigue siendo el punto de integración futuro; esta entrega no cambia sus archivos.

El objetivo es que PLANO convierta una visita o planos de proyecto en una propuesta de presupuesto trazable, usando el catálogo de GARAL. Podemos desarrollar la capacidad con bibliotecas y modelos como componentes, sin depender de un producto de presupuestación externo. La compra de equipos de captura profesionales está dentro del alcance autorizado por Hugo.

## Qué funciona

- Extraer trazados lineales, colores y palabras de un PDF vectorial, conservar su identidad SHA-256 y señalar las curvas y las imágenes que no se interpretan.
- Vincular un trazado seleccionado con la fuente, la página y una referencia de escala. El origen de coordenadas es superior izquierdo; la rotación ya está aplicada.
- Calcular longitudes y superficies de polígonos simples. La escala se confirma mediante dos puntos y su distancia real en metros; no se toma del rótulo «1:50» de forma automática.
- Calcular superficie neta de pared a partir de longitud, altura y superficies de huecos. Los huecos se descuentan solo cuando lo pide la actuación: las reglas comerciales de deducción de GARAL siguen pendientes.
- Recibir medidas declaradas procedentes de medición manual, distanciómetro, dictado de una medida o exportación de captura métrica; distinguirlas de una estimación visual. Esto no importa ni valida E57, LAS, PLY, USDZ o DWG.
- Convertir las cantidades en partidas con los precios e IVA del catálogo autorizado. Se reutiliza el cálculo en céntimos de `domain.ts` y sus límites, con cantidades finales a tres decimales.
- Mostrar líneas pendientes cuando faltan datos o hay unidades incompatibles, y calcular únicamente el subtotal de las partidas incluidas y resueltas.
- Devolver una propuesta para revisión, sin guardar ni alterar presupuestos.

## Qué falta para el flujo automático completo

Reconocimiento de estancias y actuaciones en imágenes; transcripción e interpretación de voz; OCR de cotas; detección de muros y huecos; comparación geométrica entre planos; normalización de nubes de puntos; pantalla de calibración y revisión; almacenamiento de ejecuciones, evidencia y decisiones; incorporación auditada al borrador. No hay llamadas a un modelo de IA en esta entrega ni un porcentaje de precisión demostrado.

El catálogo real de GARAL sigue pendiente. Los precios sintéticos de las pruebas no se usan como tarifas de GARAL.

## Uso del lector PDF

Python 3.12 y dependencias fijadas en `scripts/captura/requirements.txt`. Se recomienda un entorno virtual propio para el trabajador.

```sh
python -m pip install -r scripts/captura/requirements.txt
python scripts/captura/extract_pdf.py /ruta/plano.pdf --pages 1 --output /ruta/nueva-extraccion.json
```

El destino debe ser nuevo. El comando no sobreescribe el original ni un JSON existente. El JSON incluye texto del documento y se considera privado: debe permanecer fuera del repositorio y de los registros públicos.

El lector admite hasta 50 MiB y 200 páginas, y limita objetos por página. Estos límites son de inspección local, no aislamiento frente a PDF hostiles: para producción debe ejecutarse en un trabajador separado con límites de memoria/CPU, tiempo máximo, sin red y con entradas temporales privadas. No ejecutar Python ni procesar una nube de puntos pesada dentro de una petición de Vercel.

El JSON conserva el color original, que puede estar en distintos espacios de color. No clasifica por rojo/verde ni deduce que un contorno cerrado sea una estancia. Los trazados Bézier se omiten con recuento explícito; un PDF escaneado requiere un flujo distinto.

`measurementFromPdfPath` conecta una extracción con una fuente del mismo SHA-256 y una escala de la misma página. El identificador del trazado se conserva en la medición. Esta comprobación es de coherencia de los datos suministrados; no prueba que el navegador o un modelo hayan enviado el contenido auténtico del archivo. La fase de persistencia deberá descargar y verificar los originales desde almacenamiento autorizado.

## Contrato para conectar la interfaz

`POST /api/estimaciones/previsualizar`, JSON y cabecera `Origin` del propio sitio. Exige sesión real y permiso de preparación de presupuestos (`admin`, `office`, `manager` según los roles actuales). Se comprueba el proyecto, la organización y cualquier documento referenciado. `site` puede aportar archivos con el flujo existente, pero no ejecutar esta operación económica.

El esquema exportado `estimateInputSchema` de `src/lib/captura/schema.ts` es la fuente de verdad del contrato. Datos requeridos:

- `schema_version: 1`, `project_id` y `scope` con el alcance solicitado.
- `sources`: origen, identificación y fase del material. Las fotografías y panorámicas no declaran geometría métrica.
- `calibrations`: referencia de escala por fuente y página.
- `measurements`: cantidades declaradas o geometría que se quiere medir. Una longitud usa `ml`; una superficie, `m²`.
- `intents`: artículo solicitado, fórmula de cantidad, inclusión y ajuste. Un ajuste distinto de cero requiere motivo.

La petición no acepta precios, catálogo, rol, organización, aprobación ni código ejecutable. El servidor carga las tarifas de la organización autenticada. No descarga URL externas, no invoca proveedores y no escribe en base de datos.

Una respuesta válida contiene `{ proposal }`. Todas las propuestas tienen `status: "proposal"`, `review_required: true` y `persisted: false`. `complete` solo significa que las actuaciones suministradas se pudieron calcular; no acredita que cubran toda la reforma ni que las mediciones sean correctas. Una línea bloqueada incluye un código y un texto accionable. Las partidas opcionales/excluidas conservan su cantidad pero no forman parte del subtotal.

`priced_subtotal` contiene `base`, `tax`, `total` en céntimos. No se debe etiquetar como presupuesto total mientras haya actuaciones pendientes. No se genera una horquilla fija ni un porcentaje de confianza inventado.

El caso completo sintético y las pruebas de contrato están en `tests/captura/fixture.ts`, `pdf-path.test.ts` y `api.test.ts`. Para probar el cálculo sin configurar Supabase se puede importar `createEstimateProposal` con un catálogo local de demostración; la ruta HTTP nunca ofrece un bypass de autenticación.

## Incorporación al presupuesto y versiones

Diseño de la siguiente fase, todavía sin implementar:

1. Guardar una ejecución con identidad de cada original, versión del extractor/modelo, parámetros, catálogo utilizado, respuesta automática y usuario. Las correcciones se añaden como decisiones; la evidencia original se conserva.
2. Revisar la propuesta en el contexto del proyecto. Corregir cantidades, artículo y alcance; mostrar cada fuente y explicar lo que está pendiente.
3. Elegir el presupuesto y el ámbito: un proyecto puede tener apartamento, piso y terraza. Si hay una versión aprobada, mantenerla y trabajar sobre una revisión nueva o un borrador ya abierto.
4. Mostrar los cambios frente al borrador y pedir una acción explícita para incorporarlos. Usar `expected_revision` para detectar cambios concurrentes y una clave de idempotencia para no duplicar partidas al reintentar.
5. Persistir la relación entre decisión, partida y versión en la misma transacción que el guardado. El `budget.save` actual conserva partidas y notas, pero no evidencia estructurada; no presentarlo como integración auditada hasta ampliar el contrato y la migración.

Los IDs de las actuaciones se mantienen como IDs de partida. La recalculación de una misma propuesta puede conservar identidad; extraer otra versión de un plano requiere emparejar los elementos de forma explícita. Reutilizar un ID por casualidad o confiar en el nombre del archivo no constituye una comparación de revisiones.

## Límites prácticos al interpretar los planos de GARAL

Los PDF exportados desde AutoCAD que examinamos son una buena entrada para geometría. El color se interpreta junto con el tipo de plano y su leyenda: rojo en demolición y rojo en iluminación no tienen el mismo significado.

Un tabique puede tener dos caras, hachurado, encuentros y cotas. Medir la suma de todas las líneas de un color sobredimensionaría la cantidad. La detección deberá proponer ejes/elementos físicos, resolver duplicados y pedir confirmación cuando haya ambigüedad. Los rellenos y sus diagonales tampoco equivalen a perímetros o superficies de obra.

Para paredes se necesita altura; para acabados, alcance y calidades; para residuos y accesos, datos de la visita. Una fotografía del estado actual no dice por sí sola qué quiere cambiar el cliente. Los trabajos no visibles permanecen como preguntas o partidas pendientes.

## Verificación de esta entrega

- Pruebas TypeScript: geometría, puente PDF→medición→partida, límites, tarifas, roles, origen HTTP y aislamiento entre proyectos. Se ejecutan con `npm run check` junto al resto del proyecto.
- Pruebas Python sintéticas: rotación, colores, separación de subtrazados, omisión de Bézier, documentos raster y archivos no PDF. Ejecutar con `python -m unittest discover -s scripts/captura -p 'test_*.py'`; dependencias en `requirements-test.txt` y CI propia.
- Ensayo local sobre 31 planos del paquete de ejemplo: 31 páginas procesadas, 64.228 trazados lineales extraídos y 3.230 objetos omitidos por operadores/curvas no soportados. Dos superposiciones revisadas visualmente. Esto comprueba extracción y alineación de esos ejemplos; no mide exactitud del presupuesto ni exhaustividad de detección.
- Los originales, textos extraídos y superposiciones permanecen en `/private/tmp/plano-captura-validacion` y no se versionan.

## Lecturas técnicas

- [pdfplumber: objetos, coordenadas y trazados](https://github.com/jsvine/pdfplumber).
- [RoomPlan: captura con cámara y LiDAR y representación paramétrica](https://developer.apple.com/augmented-reality/roomplan/).

Las capacidades de equipos, formatos y modelos se verificarán con documentación del fabricante y una prueba propia antes de elegirlos.

## Segunda entrega: laboratorio y propuestas de franjas

`/laboratorio/planos` permite probar el trabajo en el navegador con geometría sintética o abrir un JSON del lector local. La geometría real no se incluye en la aplicación ni en las pruebas versionadas. El archivo se procesa en la pestaña: no se sube al servidor, no llama a la API económica ni usa el catálogo de producción.

La vista conserva escala, leyenda y decisiones por página. Se puede marcar una distancia conocida con dos pulsaciones o introducir sus coordenadas, indicar su longitud en metros y describir la referencia. El significado de los rellenos se asigna explícitamente a Demoler/Construir/Ignorar; no se infiere por rojo/verde en archivos importados. Los colores gris, RGB y CMYK básicos se normalizan para presentar la leyenda, sin interpretación de perfiles ICC o patrones.

`proposeWallCandidates` propone ejes de franjas rectangulares rellenas con relación largo/ancho de al menos 5. Admite rectángulos rotados y elimina vértices intermedios colineales. Los planos de AutoCAD examinados también contienen franjas como dos triángulos: se unen solo parejas del mismo significado/color que comparten la diagonal y reconstruyen un rectángulo compatible. Los trazados duplicados se agrupan manteniendo todos sus identificadores; los dos triángulos que forman una franja no se cuentan como duplicados.

El detector no reconoce de forma general qué es un muro: puede proponer mobiliario o símbolos alargados del mismo color. No une tramos contiguos, no resuelve encuentros, no detecta curvas, no interpreta trazos sin relleno y no completa partes ausentes. Las propuestas siempre requieren revisión. Las longitudes no equivalen a superficie de tabique: faltan altura, huecos y reglas de medición.

Se revisaron dos extracciones del paquete de GARAL, con reglas de leyenda explícitas para esa exploración: 11 candidatos en demolición y 8 en tabiquería nueva. Estas cifras son resultados del detector, no número comprobado de muros ni precisión acreditada.

El laboratorio descarga `revision-plano.json`, con identidad del original, referencias, leyenda, candidatos y decisiones. Es un archivo de revisión local, no un presupuesto ni una decisión persistida en el CRM. La descarga todavía no se puede reabrir directamente como extracción: debe conservarse junto al JSON de geometría. Una incorporación transaccional al proyecto sigue pendiente.

Límites de la vista: JSON de hasta 20 MiB, máximo 12.000 trazados por página y presentación de los 20 colores de relleno más frecuentes, con aviso si hay más. Los archivos que exceden el límite se rechazan antes de sustituir la revisión actual. La vista muestra geometría lineal, sin imágenes incrustadas ni curvas omitidas.

`measurementFromWallCandidate` vuelve a calcular el candidato desde la extracción y la leyenda antes de producir su medición de eje. Comprueba identidad de fuente, página y escala, y conserva `derived_from_path_ids`, incluidos los trazados triangulados o duplicados. Una prueba sintética conecta ese eje de 5 m con una altura declarada de 2,5 m, obtiene 12,5 m² y aplica el artículo de demolición del catálogo de prueba. Es una prueba del circuito de cálculo; no acredita esas dimensiones en un plano real.

La comprobación de navegador está en `tests/captura/lab.browser-check.cjs`. Con un servidor local arrancado en el puerto 3117, ejecutar `node tests/captura/lab.browser-check.cjs`; usa el Chromium de Playwright instalado. Se puede indicar `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` para un Chrome existente y `PLAYWRIGHT_BASE_URL` para otro puerto. Las capturas van a `test-results/captura-lab` (o `PLANO_BROWSER_OUTPUT`). La prueba opcional del ejemplo local 040 se activa con `PLANO_BENCH_PLAN_040`; ese archivo no forma parte del repositorio. Se comprueban decisiones, descarga, invalidación por cambio de escala, protección al cambiar de archivo y ausencia de desbordamiento en 390/768/1280 px con los dos temas.
