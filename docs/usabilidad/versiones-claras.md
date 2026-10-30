# Versiones claras: fechas, referencia de obra y comparación

La base visual es la interfaz de Fable en main d91acc2. Hugo ha señalado que la simplificación anterior ocultaba información importante. Se conserva la lectura por filas y los capítulos abiertos; se corrigen los puntos concretos que impedían saber qué presupuesto se está consultando.

## Un significado por dato

- Actual identifica la revisión que se está preparando o, si no hay cambios en preparación, la aprobada. El verde acompaña exclusivamente a esa etiqueta en el componente de identidad; no decide la autorización para obra.
- Para obra identifica la versión referenciada por `approved_version_id`. Puede ser anterior a la actual. Se muestra con texto explícito y sin otra insignia verde que compita con Actual.
- El importe grande del resumen lleva el número de la versión actual y su estado. La referencia aprobada, su importe y fecha se presentan separados; un borrador dice que no está aprobado.
- La fecha de creación de cada versión permanece visible, con día, mes, año y hora. La edición se identifica como edición; no se atribuye al autor de creación. Formato de presentación Europe/Madrid.
- El mismo componente de identidad se utiliza en resumen, fila e historial, listado de presupuestos y consulta desde chat.

## Comparación

Primero se explica si el presupuesto sube, baja o mantiene el total, siempre con IVA. Las dos versiones y sus fechas se nombran por separado. Cada partida ofrece una explicación determinista del cambio y su impacto efectivo con IVA. Una alternativa no suma por tener precio. Antes y después, cálculo e impuestos están disponibles en detalles, sin tachados como única forma de entender el cambio.

Las condiciones conservan su texto completo y resaltan los fragmentos diferentes. Una comparación hacia una versión anterior usa Referencia/Comparada para no inventar una cronología inversa.

## Vínculo de partidas

La carga de ejemplos asignaba un UUID nuevo a cada partida de cada versión, haciendo aparecer todas como altas y bajas. Ahora mantiene un mapa de identidad dentro de cada presupuesto. La regresión exige tres modificaciones, una alternativa añadida y ninguna baja en el ejemplo Monte Alto. No se altera ninguna aprobación existente.

Si dos versiones antiguas no comparten ninguna identidad, se informa de esa limitación. No se enlazan partidas por tener un nombre parecido ni se reescriben aprobados para que el informe parezca más limpio.

## Fechas de los cambios

Las versiones existentes no guardan la fecha individual de cada cambio de partida. La interfaz distingue la fecha de guardado de la versión de ese dato no registrado. No se reconstruyen fechas a partir del orden de las filas o de un motivo escrito. La persistencia de ediciones por partida será una entrega separada; las fechas anteriores no se podrán inventar al activarla.

## Comprobación

`npm run check`: 300 pruebas y una privada omitida, tipos y compilación correctos. Nuevas pruebas de IVA, alternativas sin coste añadido, identidades no vinculadas, dirección de comparación y fechas/roles explícitos. La configuración de Vitest incluye ahora también `.test.tsx`, para ejecutar estas pruebas de presentación.

Recorrido de navegador específico: fecha visible por versión, Actual en borrador separado de Para obra y comparación nombrada Antes/Después; 390/768/1280, claro y oscuro, sin desbordamiento ni errores. No acredita todavía una prueba de comprensión con personas nuevas.
