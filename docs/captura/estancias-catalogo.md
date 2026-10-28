# Captura y propuesta por estancias

Esta entrega prepara el motor y la API para asociar fotos, panorámicas, planos, mediciones, dudas y artículos por estancia o zona de una vivienda, nave, local u otro inmueble. **Todavía no conecta este contrato a la pantalla de visita ni persiste la asociación en servidor.** No anuncia análisis automático de imágenes ni reconstrucción 3D.

## Contrato para la interfaz

`POST /api/estimaciones/estancias` acepta `roomSurveySchema` de `src/lib/captura/room-survey.ts` y devuelve `{ proposal }`. Requiere sesión, mismo origen y un perfil autorizado para preparar presupuestos. No guarda ni aprueba ninguna revisión.

La entrada contiene:

- `schema_version: 1`, `project_id` y alcance general `scope`.
- `sources`: fuentes del contrato existente `captureSourceSchema`. Fotos y panorámicas deben llevar `document_id` del original ya adjunto al proyecto. La API comprueba organización, proyecto y MIME de fotos, PDF y vídeos; no descarga los archivos ni contrasta todavía el SHA declarado.
- `calibrations`: referencias de escala del contrato existente. Una fotografía o panorámica no se convierte en fuente métrica por tener una referencia escrita.
- `rooms`: cada estancia tiene UUID estable, nombre, alcance, fuentes, observaciones, mediciones, selecciones y preguntas. No hay un vocabulario limitado a vivienda: una zona puede llamarse «Nave · almacén».

Cada estancia contiene `source_ids`, `observations: [{ source_id, note }]`, `measurements` del contrato existente y `questions: [{ id, question, required, answer }]`. Una observación es una anotación declarada: no se considera una conclusión verificada por IA. Se puede compartir un plano o instrumento entre zonas, pero las mediciones pertenecen a una única estancia. Un trabajo no resuelve la medición de otra habitación por accidente.

Las selecciones tienen dos formas:

- Trabajo: `{ kind: "work", intent }`, donde `intent` es el contrato existente con ID, artículo, fórmula, inclusión y ajuste con motivo. Para una cantidad aún desconocida, la fórmula puede apuntar al UUID reservado para la futura medición; el motor devolverá una partida bloqueada, sin inventar metros.
- Contexto: `{ kind: "context", id, label, article_id, purpose: "existing" | "decoration" }`. No necesita una cantidad ficticia y nunca genera una partida. La respuesta indica si el artículo existe en el catálogo autorizado, sin exponer datos de otras organizaciones.

Las preguntas necesarias sin respuesta quedan en `pending_questions`. Pueden tratar accesos, ascensor, estado de instalaciones, elementos que se conservan o alcance no visible. Las respuestas siguen siendo declaraciones; este servicio no certifica que se hayan comprobado.

Ejemplo sintético completo y ejecutable en `tests/captura/room-fixture.ts`: foto de teléfono para una zona, panorámica para una nave, medidas manuales declaradas y un mueble que se conserva. No incorpora archivos ni tarifas comerciales de GARAL.

## Cambio de artículo y cálculo

`replaceRoomArticle(input, roomId, selectionId, articleId)` devuelve una copia validada. Conserva IDs, mediciones, fórmulas, inclusión, ajustes y procedencia; solo cambia el artículo de esa selección. Después se vuelve a llamar a `createRoomProposal` o a la API con la nueva entrada.

El precio y el IVA salen del catálogo autorizado en el servidor. No se aceptan precios inyectados en el cuerpo. Cambiar un artículo en m² por uno en unidades bloquea la partida: no se convierte la cantidad ni se reutiliza un importe antiguo. La compatibilidad comprobada aquí es de unidad; adecuación técnica, calidad, instalación incluida y disponibilidad requieren reglas adicionales y revisión profesional.

La respuesta conserva las selecciones, observaciones, mediciones y preguntas por estancia. Cada línea calculada incorpora `room_id`, `room_label`, artículo y mediciones de origen. Hay subtotal por estancia y general, usando el mismo cálculo en céntimos e IVA del CRM. Las partidas opcionales/excluidas mantienen las reglas económicas actuales. La decoración o el estado existente quedan fuera del cálculo incluso al intercambiar artículos.

`complete` significa que todos los trabajos suministrados tienen cálculo y no quedan preguntas obligatorias vacías; no demuestra que el alcance cubra toda la reforma. Las estancias sin trabajos no aportan importe y una propuesta sin ningún trabajo nunca es completa. Las cantidades visuales se identifican con `has_visual_quantities` y con los avisos de cada línea. Una foto o 360 no puede presentarse como exportación métrica. Toda respuesta lleva `review_required: true` y `persisted: false`.

## Integración siguiente

Fable puede reutilizar su captura de visita: subir los originales con `upload`, asignar los documentos a estancias y construir esta entrada con selectores/dictado. La PR #40 hace que `upload` devuelva el documento exacto creado. No hay que pedir JSON a GARAL; este JSON es el contrato interno entre pantalla y servidor.

Antes de guardar una propuesta real falta persistir la captura por proyecto y la procedencia por partida en la misma revisión, con control de concurrencia. La API actual solo previsualiza. No debe copiarse una propuesta encima de una versión aprobada ni reescribirse un precio histórico al actualizar el catálogo. El vínculo a modelos/materiales 3D y el recorrido fotográfico llegarán sobre estas mismas selecciones, sin contar mallas como cantidades.

No se ha contratado un proveedor de imágenes, enviado originales a análisis externo, añadido una cámara específica ni aplicado migraciones de producción. Sigue pendiente comprobar el reconocimiento automático y las mediciones contra referencias reales de GARAL; no hay una precisión porcentual demostrada.

## Verificación

Pruebas de motor y API en `tests/captura/room-survey.test.ts` y `room-api.test.ts`: separación de zonas, cambio inmutable, precios autorizados, unidad incompatible, contexto sin coste, fuente visual sin escala, PDF calibrado, preguntas pendientes, IDs/fuentes inconsistentes, permisos y documentos ajenos. `npm run check`: 253 pruebas correctas, una prueba privada omitida, tipos y build correctos. Sin cambios de interfaz en esta entrega.
