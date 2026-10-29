# Lectura directa de planos PDF

El flujo «Desde un plano» lee el PDF seleccionado sin pedir a GARAL una extracción JSON. Conserva la vista y los cinco pasos de Fable. Esta entrega se apoya en la PR #39 de fiabilidad; no sustituye sus confirmaciones de escala ni permite emitir una propuesta sin revisar.

## Funcionamiento

`read-pdf-browser.ts` carga PDF.js bajo demanda y su trabajador desde `/pdfjs/pdf.worker.min.mjs`. `predev` y `prebuild` copian el trabajador y su licencia de la dependencia fijada en el lockfile; no se descarga código desde un CDN. Node debe ser >=22.13 y <25.

`read-pdf.ts` calcula SHA256 sobre los bytes originales antes de transferirlos al trabajador. Recorre las páginas y convierte sus operadores de dibujo al contrato `PdfExtraction`. El adaptador `pdf-operators.ts` aplica transformaciones, rotación de página, color, visibilidad de capas y recortes rectangulares. Los identificadores de trazo son estables para el mismo archivo y versión del lector.

Después de leer, se guarda el original en Documentos usando los permisos y almacenamiento habituales del CRM. `useWorkspace.upload` devuelve ahora el documento creado, con el que se vincula la extracción. No se adivina esa identidad por nombre o fecha. Se puede releer un plano ya adjunto sin subirlo otra vez; un archivo idéntico ya seleccionado no crea otra copia. La descarga y lectura comparten un bloqueo y señal de cancelación, también al salir de la pantalla.

La extracción y los avisos siguen en el borrador local del flujo. **Todavía no están persistidos en servidor ni disponibles al retomar desde otro dispositivo.** El SHA identifica el original leído, pero el servidor no ha contrastado aún ese SHA con Storage. No presentar este incremento como el trabajador asíncrono ni la trazabilidad persistente completos.

## Fiabilidad y límites

- Solo se conservan contornos lineales compatibles. No se convierten cajas envolventes en áreas.
- Curvas, rellenos compuestos con posibles huecos, recortes complejos, patrones y efectos no interpretados se omiten y se informan. Es preferible una lectura parcial visible a inventar una pared.
- Una imagen incrustada no aporta geometría métrica. Un escaneo sin trazos queda pendiente de otra fuente de medidas. Esta entrega no añade OCR ni reconstrucción fotográfica.
- Las capas ocultas y rellenos completamente transparentes no se presupuestan.
- Hasta 50 MB y 20 páginas; tiempo de espera de 45 segundos en operaciones asíncronas. Hay límites por página de 250.000 operadores, 12.000 trazos, 500 puntos por contorno y 100 niveles anidados; 50.000 trazos por documento. Los límites no garantizan el mismo rendimiento en todos los teléfonos.
- La extracción no comprende por sí sola el alcance de la reforma, alturas, instalaciones ocultas o precios. Siguen siendo necesarios escala, elección/revisión de trabajos y artículos del catálogo.

La tarjeta del plano muestra los avisos. La revisión final recuerda que lo no interpretado debe añadirse antes de emitir el presupuesto. La importación JSON queda en «Opciones de soporte», cerrada inicialmente.

## Verificación

Pruebas sintéticas del lector: rellenos, transformaciones/restauración, rotación, curvas, rellenos compuestos, recortes, capas ocultas, transparencia, archivo inválido, cancelación y PDF de imagen sin medidas inventadas. La prueba móvil `tests/plan/pdf-upload.browser-check.cjs` verifica el trabajador local, el SHA original, vínculo al documento, relectura sin duplicados y lectura sin geometría.

Comprobación privada opcional: `tests/captura/pdf-real.local.test.ts`, con `PLANO_PRIVATE_INVENTORY` y `PLANO_PRIVATE_ROOT` apuntando a los ejemplos locales de GARAL. No sube originales a ningún servicio y no se ejecuta en CI. Los 31 PDF de planos se procesaron: 63.879 trazos lineales; 3.230 contornos curvos y 174 rellenos compuestos omitidos. Todos quedaron como lectura parcial. No equivale a validar las mediciones ni el coste final de 31 obras.

Siguiente entrega: persistir extracción y procedencia por documento/revisión; después, mejorar recintos, símbolos y fuentes fotográficas sin alterar el motor económico ni aprobar automáticamente.
