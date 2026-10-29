# Fiabilidad del flujo de varios planos

Incremento de Codex sobre `main` 8535eff, después de las PR 37 y 38 de Fable. Se conserva su flujo en cinco pasos. Los cambios de interfaz se limitan a las decisiones que necesitan los cálculos.

## Escala

El mismo formato de página no demuestra que dos dibujos tengan la misma escala. Dos A4 pueden contener el mismo inmueble a 1:50 y 1:100; compartir la medida produciría errores en longitudes y superficies. `mismaHoja` queda como sugerencia de papel, sin autoridad métrica.

Una medida propia o la confirmación expresa de compartir escala habilita cada plano. La confirmación incorpora identidad SHA256 de ambos archivos, páginas y referencia medida; cambiar cualquiera de esos datos obliga a revisarla. Al cambiar una página se elimina también su medida propia. La línea de medida del plano de referencia no se dibuja encima de otro archivo como si se hubiera medido allí.

La confirmación de escala la realiza el profesional que conoce los planos; no demuestra ausencia de deformación ni sustituye una medición de control. El flujo deja de sugerir que todas las puertas tienen 80 cm.

## Superficies, huecos y redondeo

`wall_area` admite la forma anterior `length_id` o una lista `length_ids`, nunca ambas. La fórmula para varias paredes es `(suma de longitudes × altura − huecos) × caras`. Se comprueban referencias repetidas, unidades y cantidades positivas. `faces` opcional admite una o dos caras; las peticiones anteriores siguen funcionando.

Cada trabajo genera una sola partida directamente en el motor. Se evita descontar todos los huecos de la pared más larga y rechazarla cuando los huecos pertenecen a varias paredes. El cálculo conserva longitudes completas y redondea la cantidad final a tres decimales; los importes siguen el motor económico del CRM. La base de la propuesta se obtiene de las mismas partidas que se guardarán.

Los huecos de demolición y los de paredes nuevas se indican por separado. Para pintar dos caras se descuenta la abertura en ambas caras. Los artículos en metros lineales mantienen su unidad sin convertir huecos en m² a longitudes. La altura y los huecos negativos/no numéricos bloquean el cálculo. El valor inicial de altura se identifica como referencia por confirmar.

Los borradores locales anteriores conservan sus valores y vuelven como máximo al paso de trabajos para revisar el antiguo campo común de huecos. Las confirmaciones de escala antiguas no se inventan. Todavía se utiliza una sola altura para las paredes seleccionadas; espacios con alturas distintas requieren separar el alcance hasta que se incorpore altura por conjunto.

## Presupuesto existente

Las coincidencias se reconocen por identidad o descripción, nunca solo por compartir precio y capítulo. Cada partida existente puede emparejarse una sola vez. El guardado requiere elegir expresamente sustituir o añadir; no existe sustitución por defecto. Al sustituir se conserva el ID existente y se aplican los datos de la partida calculada, sin conservar inadvertidamente ajustes/opcionalidad antiguos. La revisión muestra el cambio real de base tras las sustituciones.

Los trabajos pendientes de artículo o medición deben completarse o desmarcarse antes de añadir. Un plano sin escala no se omite silenciosamente de una propuesta parcial. Cargar el mismo PDF y la misma página con otro nombre no duplica sus paredes. No se detectan aún revisiones distintas del mismo plano físico: GARAL debe escoger qué versión representa el alcance.

## Verificación

Pruebas unitarias en `tests/plano-flujo.test.ts` y `tests/captura/estimate.test.ts`. Prueba de recorrido con datos sintéticos en `tests/plan/flow.browser-check.cjs`: escala pendiente/confirmada/cambiada, huecos por estado, decisión de coincidencias, guardado en borrador, versión aprobada intacta y revisión responsive en tres tamaños y dos temas.

Pendientes prioritarios: lectura directa del PDF al subir, almacenamiento de extracción/borrador/evidencia en servidor, recintos y superficies, revisión de las mediciones con GARAL, fotografías métricas y panorámicas. Esta corrección no equivale a una precisión de presupuesto validada en obras reales.

La comprobación de navegador aisló un bloqueo al precargar las rutas visibles del armazón. Se desactiva esa precarga en sus enlaces y los de salida del flujo, manteniendo la navegación de Next. No se parchea la biblioteca ni se afirma un fallo general de Next fuera de esta reproducción. El recorrido de prueba debe pasar sin interceptar o bloquear peticiones.

Verificación final de este incremento: `npm run check` correcto (222 pruebas / 34 archivos, tipos y build). Recorrido de navegador correcto sobre `next start` local: seis combinaciones de ancho/tema, sin errores de ejecución, cantidades 9,4 / 4,24 / 8,48 m² guardadas en V2 y V1 aprobada intacta. También se corrige la hidratación de la página para que la restauración de un borrador local no difiera del estado inicial del servidor.
