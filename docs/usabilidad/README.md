# Usabilidad de PLANO · primera entrega

Hugo ha pedido el 29 de octubre de 2026 simplificar a fondo el uso del CRM, con permiso expreso para modificar interfaz y sistema de diseño. Esta entrega aborda la ficha, el presupuesto, su historial y el editor. No equivale a una validación con usuarios nuevos ni a completar el rediseño de todos los módulos.

## Criterio de interfaz

Una pantalla debe responder a una tarea: entender el estado, leer un presupuesto, editarlo o comparar versiones. Datos secundarios, condiciones extensas y opciones poco frecuentes se abren cuando se necesitan. Se conserva Workspace/Grafito, la identidad y el motor económico.

La ficha abre en Resumen, con siguiente acción, avance y acceso al presupuesto. Presupuesto, Obra, Documentos y Compras tienen sus propias secciones. Tareas completadas, actividad y certificaciones se consultan aparte. El resumen económico ya no mezcla una base global del proyecto con la revisión de un solo presupuesto.

## Presupuestos y versiones

- Selector visible de cualquier versión; «Partidas», «Versiones» y «Comparar cambios» no dependen del chat.
- La aprobada para obra y el borrador en preparación se identifican por separado. Las anteriores son consultables y no muestran acciones de edición sobre otra versión.
- Historial con fecha de última edición, autor de creación, motivo, importe y diferencia real respecto a la versión anterior. El autor de creación no se presenta como autor del último guardado.
- Comparador con Desde/Hasta, cantidades, precios, unidades, IVA, inclusión y condiciones. Diferencia de base, IVA y total separadas. Un cambio solo de notas nunca se anuncia como ausencia de diferencias.
- Antes/después explícitos, texto modificado subrayado y texto anterior tachado. Los colores acompañan al significado.
- Partidas agrupadas en capítulos desplegables; opciones de captura y condiciones extensas plegadas. El editor prioriza descripción, cantidad, precio e importe; ajuste, inclusión y unidad quedan en «Ajustes y opciones». Los ajustes ya aplicados y las alternativas siguen indicados fuera de ese despliegue.
- No hay todavía historial de cada pulsación o guardado dentro de un mismo borrador. El historial es de versiones del presupuesto.

`budgetHistory` evita que una versión antigua `issued` reaparezca como revisión pendiente tras aprobar una posterior. Se reutiliza en ficha, listas, alertas, chat y preparación desde planos. No se cambian políticas de aprobación ni datos ya aprobados.

Las vistas de la misma ficha usan una actualización atómica de parámetros mediante History API, integrada por la versión instalada de Next, para mantener selección y pareja de comparación sin volver a solicitar los mismos datos. No se utiliza para cambiar de proyecto ni obtener nuevos datos del servidor. Recargar conserva la selección. La ficha conserva una instantánea de hidratación inicial coherente.

## Legibilidad y teclado

Tokens de texto auxiliar: 12/13/14 px, conservando jerarquía y fuentes. Botones de escritorio e iconos: objetivo de 44 px. Las pestañas admiten flechas, Inicio y Fin, con foco administrado; selectores de versión nativos funcionan también en móvil. Se mantienen ambos temas y no se añaden colores fuera de tokens.

## Comprobación

`tests/budget-history.test.ts` cubre cerradas históricas, orden de versiones, condiciones sin cambio económico, IVA, inclusión y comparación dentro del mismo presupuesto. El recorrido `tests/usabilidad/presupuesto.browser-check.cjs` usa solo demostración sintética: selección libre, historial, comparación, nueva revisión, edición y aprobación anterior intacta, restauración al recargar y tres anchuras en ambos temas.

Verificación final: recorrido correcto en 390/768/1280 px y ambos temas, sin errores ni desbordamiento, creación de nueva revisión, corrección de descripción sin plegar el capítulo, guardado y aprobada intacta. También pasa la regresión desde planos (cantidades 9,4 / 4,24 / 8,48 m², aprobada intacta). Comprobación integrada local: 281 pruebas + una privada omitida, tipos y build; 19 pruebas corresponden a la entrega separada de supervisión. No se ha hecho todavía una prueba de comprensión con personas nuevas.

## Próximas pantallas

1. Captura de visita: fotos/nota directamente, sin repetir Datos de un proyecto existente; después preparar presupuesto por estancias.
2. Documentos: reutilizar la previsualización en la aplicación en lugar de abrir ventanas de forma inconsistente.
3. Hoy: priorizar pendientes por persona; esta entrega ya pliega resumen de empresa, próximas tareas, completadas y actividad, y limita los siguientes pasos visibles.
4. Agenda, compras y finanzas: aplicar la misma separación entre consulta, acción principal y opciones.
5. Validación con perfiles reales: persona nueva, administración y jefe de obra. Observar si localizan la aprobada, explican un cambio, añaden fotos y retoman una tarea sin ayuda.

La zona de supervisión del sistema es una entrega separada: documentación de capacidades, límites y registro de cambios, con acceso de plataforma verificado en servidor. La autocorrección supervisada sigue siendo un procedimiento definido; no se ejecutan cambios de código ni de datos a partir de errores.
