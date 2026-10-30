# Fechas de edición de partidas

Cada guardado que cambia una partida registra la fecha del servidor, la persona autenticada y los valores anteriores y posteriores. Incluye altas y eliminaciones. El comparador muestra la última edición de esa partida en la versión seleccionada. Los eventos completos se conservan en la base de datos; esta entrega no incorpora una pantalla de todos los guardados intermedios.

La fecha de creación de la versión, su último guardado y la última edición individual son datos distintos. Copiar una versión, reordenar partidas o guardar solo condiciones no cambia la fecha de las partidas. Una partida copiada sin modificaciones no adquiere una fecha de edición nueva. Las versiones antiguas sin registro conservan la fecha conocida del presupuesto y señalan la ausencia del dato individual. No se deducen fechas de nombres, posición, motivos o importes.

## Persistencia y permisos

Migración `202610300001_budget_item_events.sql`: tabla de eventos, trigger transaccional y lectura de última edición por partida. Fecha y autor salen del servidor; el cliente no puede insertar, alterar ni borrar eventos. RLS limita la consulta a miembros de la empresa. El registro no admite escrituras directas de perfiles autenticados, incluido administración. El contenido de una versión aprobada conserva sus protecciones existentes.

El trigger observa cambios efectivos de los ocho campos comparables. Los reintentos idempotentes, conflictos y guardados rechazados no producen eventos adicionales. Se conserva el número de guardado para consultar únicamente fechas pertenecientes a la instantánea mostrada, incluso si otra persona guarda mientras se abre el comparador.

`GET /api/budgets/[id]/versions/[version]/changes?revision=N` verifica empresa, presupuesto y versión, pagina sin truncar y devuelve cabeceras privadas sin caché. La falta de la función por migración pendiente se distingue del histórico sin cambios y de errores de lectura. El comparador no presenta un fallo de conexión como ausencia de fecha.

La demostración local usa el mismo contrato y guarda los eventos con el resto del espacio. Sus fechas pertenecen al navegador de demostración, no constituyen auditoría de producción. Los espacios guardados antes de esta entrega son compatibles; no se rellenan con fechas ficticias.

## Activación

La migración `202610300001` se aplicó en Supabase de producción el 30/10/2026, con autorización explícita de Hugo para fusionar #63/#64 y activarla. Se ejecutó en una transacción que también registró la versión en `supabase_migrations.schema_migrations` y notificó la recarga del esquema API.

Verificación de producción mediante lectura de catálogo: tabla y función existentes, trigger activo, RLS habilitada, lectura para miembros autenticados y ausencia de permisos directos de inserción, actualización y borrado. El acceso anónimo a la tabla está denegado. No se editaron presupuestos reales para probar el registro ni se reconstruyeron fechas antiguas. Las nuevas ediciones empiezan a registrarse desde la activación.

En otros entornos que todavía no tengan esta migración, la interfaz distingue «Registro por partida pendiente de activar».

## Verificación

Pruebas reales en PostgreSQL local (PGlite): fecha/autor de servidor, cambios y valores, copia y reordenación sin eventos, RLS entre empresas, escrituras prohibidas, idempotencia, conflictos, presupuesto aprobado intacto y selección de instantánea. Pruebas de API: sesión, propiedad de la versión, paginación, revisión válida y migración pendiente diferenciada de errores. Presentación: fecha individual real, autor y ausencia explícita en históricos; nunca una fecha de otra versión.

El recorrido de navegador guarda una partida, comprueba su fecha y autor en el comparador, recarga y verifica su persistencia y la integridad de la aprobada. Solo usa datos sintéticos; no envía archivos privados ni depende de servicios externos.

Recorrido completo correcto: fecha/autor persistentes tras recargar, aprobado intacto, seis combinaciones 390/768/1280 y claro/oscuro, selección entre doce versiones, plegado y subida de fixture local. Sin errores de navegador ni desbordamiento. Captura revisada local `test-results/usabilidad/partida-con-fecha-390-dark.png` (ignorada).

Comprobación final `npm run check`: 314 pruebas correctas y una privada omitida, tipos y build correctos.
