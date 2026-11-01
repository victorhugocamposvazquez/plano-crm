# Captura por zonas que se puede retomar

Entrega sobre main d0f27cf (#74), en `codex/captura-estancias-persistente`. Integra el motor por estancias existente en una pantalla de proyecto: `proyectos/[id]/captura`. La entrada «Desde fotos» del presupuesto lleva a ella; la visita inicial y el flujo PDF siguen disponibles.

## Recorrido real

1. Crear y nombrar zonas (habitación, nave, local, exterior, etc.). Anotar lo que cambia y lo que se conserva.
2. Hacer fotos, elegirlas de la galería o vincular imágenes ya subidas. El usuario distingue foto convencional de panorama 360; esta entrega conserva el original y muestra una vista plana. No es un visor inmersivo ni reconstrucción 3D.
3. Añadir trabajos del catálogo por zona. Una cantidad vacía queda pendiente. Se anota cantidad/unidad y se declara si procede de una medida, láser o aproximación visual. No se infieren metros de la imagen.
4. Cambiar de artículo conserva las medidas. El motor recalcula precio e IVA; una unidad incompatible bloquea el trabajo. Ajustes requieren motivo; alternativas y excluidos conservan su significado económico.
5. Guardar y retomar la captura, sin alterar el presupuesto. Se puede registrar una pregunta necesaria para no olvidar accesos, instalaciones ocultas u otras comprobaciones.
6. Revisar la propuesta y elegir un borrador abierto del mismo proyecto. Incorporar guarda partidas y procedencia en una transacción. La versión aprobada no se modifica. No se abre otro presupuesto ni se elige un proyecto por coincidencia de nombre.
7. Consultar las últimas incorporaciones (hasta 20) y abrir su copia de origen: zona, artículos, cantidades y documentación. Los registros anteriores permanecen en la base de datos.

La propuesta es un subtotal de los trabajos calculados, no un precio completo garantizado. Las medidas y respuestas siguen siendo declaradas; la revisión del usuario no certifica precisión técnica. Todavía no hay análisis automático de fotos, sugerencia de trabajos, dictado interpretado ni reconstrucción realista. Las panorámicas no se tratan como exportación métrica.

## Persistencia y seguridad

Migración `202611010001_room_captures.sql`, preparada y NO aplicada en producción desde esta entrega. `room_captures` mantiene el borrador por proyecto y su revisión. `room_capture_imports` conserva una copia inmutable de la captura y las partidas en cada incorporación.

La API valida el contrato completo, pertenencia de originales y precios del catálogo de la empresa. Las tablas tienen RLS y no admiten escrituras directas. Solo responsables de presupuestos (administración, oficina, jefe de obra) pueden guardar o incorporar; los miembros con acceso de lectura pueden consultar.

Los RPC vuelven a comprobar empresa, proyecto, documentos, tipo de original, revisión y estado del presupuesto. Al incorporar, recalculan la suma de cantidades anotadas, comprueban fuente/método/unidad y verifican los precios contra el catálogo actual. No basta con saltarse la API y suministrar otro precio o cantidad. La API comprueba además que el cálculo coincide con los importes que se revisaron en pantalla; un cambio de tarifa exige revisar otra vez.

Esta primera incorporación de captura por zonas admite sumas de cantidades anotadas. Las fórmulas geométricas continúan en el flujo PDF existente, sin afirmar que se haya persistido su extracción. Conectar ese flujo a la nueva procedencia es el siguiente incremento.

Guardar exige revisión esperada; un conflicto conserva la edición en pantalla. Se puede recargar la guardada con decisión expresa de descartar los cambios locales. Guardar un mismo contenido tras perder la respuesta es idempotente. Repetir una incorporación no duplica partidas ni eventos.

Actualizar la captura puede sustituir sus partidas anteriores solo si estas siguen intactas desde su incorporación. Una modificación manual posterior bloquea la sustitución automática. Retirar un trabajo de la captura no borra su partida del presupuesto. Las versiones anteriores y los precios históricos se conservan.

En demostración, captura, presupuesto y procedencia forman parte del mismo `Workspace` y se escriben en una sola operación local. Los espacios anteriores siguen siendo compatibles. El modo real utiliza las transacciones SQL; la demostración no acredita sincronización entre dispositivos.

Los archivos se suben al almacenamiento habitual del CRM. Si falla una carga o se sale sin guardar, los originales ya subidos se conservan en el proyecto y se pueden volver a vincular. No se envían documentos de GARAL a servicios de análisis externos.

## Comprobaciones

Pruebas de dominio, editor, API y PostgreSQL local: cantidades pendientes, unidades incompatibles, panoramas sin escala, documentos ajenos, permisos, revisión optimista, importación atómica, idempotencia, precios/cantidades manipulados, edición manual protegida y aprobados intactos.

El recorrido `tests/captura/room-capture.browser-check.cjs` utiliza un PNG sintético y dos zonas; cubre subida, recarga, cambio de artículos, pregunta necesaria, incorporación, origen, salida con cambios y conflicto. La vista previa de Codex usa 3121; 3119 pertenece al checkout de Fable y no se reinicia.

La pantalla se divide en Fotos y zonas → Trabajos → Revisar, mostrando un único paso y una única zona. Los perfiles de consulta pueden cambiar de zona y consultar el origen, aunque los controles de edición e incorporación estén desactivados.
