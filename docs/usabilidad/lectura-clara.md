# Lectura del presupuesto y documentos con más espacio

Hugo ha pedido seguir mejorando la facilidad de uso porque algunas zonas seguían apelmazadas tras la integración de #62. Rama `codex/presupuesto-lectura-clara`, base `main` d91acc2. Se modifica interfaz por su autorización expresa, sin escribir en el checkout de Fable.

## Qué cambia

La cabecera del presupuesto ya no presenta fechas, base, IVA, autor y acciones como una misma línea de lectura. Primero muestra la versión, el título, el total con IVA y la diferencia frente a la aprobada; después las acciones «Historial» y «Comparar», con texto. El desglose y los datos de la versión se consultan aparte. «Creada por» describe el campo existente: no se conoce el autor de la última edición.

Cada versión conserva su número y estado, y la actual conserva su señal verde. No se comprimen doce versiones dentro del ancho de un teléfono; la fila se desplaza y sitúa la seleccionada en su área visible. El presupuesto tiene un ancho máximo de lectura de 960 px mediante token, sin hacer que descripciones e importes queden en extremos lejanos.

Los capítulos siguen abiertos inicialmente y ahora tienen separación visual, cálculo secundario e importes identificados como sin IVA. Se pueden plegar o desplegar todos; se mantiene la preferencia de capítulos del navegador por presupuesto. En móvil descripción e importe tienen espacio propio, y el resumen usa tarjetas de ancho completo. No se ocultan las alternativas ni las partidas excluidas.

En la cabecera de escritorio «Añadir trabajos» abre las mismas tres vías existentes: catálogo/manual, plano y fotos. En teléfono se mantienen en la hoja de acciones del proyecto. No se ha implementado ninguna función nueva de análisis de imágenes.

Se corrige también un fallo previo de arranque: el layout concatenaba dos exportaciones de módulos cliente como si fueran texto JavaScript. El resultado servido contenía referencias a funciones y provocaba un error de sintaxis. El script de tema y letra grande vive ahora en un módulo compartido sin «use client»; las preferencias se aplican antes del primer pintado. Tres pruebas ejecutan el script real y cubren preferencias válidas, desconocidas y almacenamiento bloqueado.

Documentos muestra antes sus archivos y la acción Adjuntar. La categoría y el selector de archivos se abren en un diálogo; la lista de requisitos queda disponible con su contador en un desplegable. Subidas correctas cierran el diálogo; un error lo mantiene abierto. La categoría elegida sigue siendo la categoría guardada del documento. El expediente no se presenta como revisado solo porque haya un archivo.

## Verificación

`npm run check`: tipos, pruebas de dominio/base de datos y compilación. El recorrido `tests/usabilidad/presupuesto.browser-check.cjs` usa datos sintéticos, revisiones con condiciones distintas, lectura histórica, edición, aprobado intacto y subida local de un PNG generado como fixture. Comprueba también plegado persistente y una selección entre doce versiones. No se usan originales de clientes ni servicios de análisis.

Revisión visual local en móvil, tableta y escritorio, ambos temas, incluido texto ampliado. Se documentará el resultado efectivo antes de entregar. No sustituye una sesión de comprensión con personas nuevas; no se ha aplicado a todos los módulos.

Sin migraciones ni cambios de permisos, precios o estados de aprobación. No se publica producción ni se fusiona main desde esta rama.
