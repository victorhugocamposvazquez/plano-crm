# Catálogo visual y propuesta navegable

Requisito de Hugo, 28-10-2026: los artículos del catálogo tendrán precios y podrán tener diseños/modelos 3D o representaciones de materiales preparados para reutilizarse. La propuesta al cliente podrá incluir un entorno virtual navegable vinculado al presupuesto. Este documento define el comportamiento previsto. Ya existe un prototipo 3D sintético para comprobar navegación y vínculo con artículos, descrito en `espacio-navegable.md`; la carga de modelos reales y la reconstrucción están pendientes.

## Experiencia prevista

El profesional captura el inmueble o aporta planos y explica la reforma. PLANO propone el espacio y las actuaciones con los datos disponibles, obtiene cantidades justificadas y selecciona artículos del catálogo. GARAL revisa las dudas y las elecciones comerciales.

A partir de esa propuesta, el cliente podrá ver una planta general, entrar en estancias y recorrer la distribución propuesta. Donde haya datos y modelos suficientes podrá consultar productos y comparar acabados o alternativas. El recorrido y la estimación rápida son procesos relacionados que deben poder completarse de forma independiente: la preparación del 3D detallado no debe retrasar la orientación económica inicial.

La configuración se hará por los profesionales de GARAL; Hugo no tiene que modelar espacios ni medir planos para usar el producto. Preparar la biblioteca inicial es una tarea de implantación que se reutiliza entre proyectos.

## El artículo es la referencia común

El catálogo económico conserva la referencia del producto, variante, unidad, precio e IVA. Los recursos visuales se vinculan a esa referencia: modelo 3D para un sanitario, puerta o mueble; material/textura para suelo, azulejo o pintura; imagen de referencia si todavía no hay un modelo.

La preparación de recursos podrá aprovechar modelos facilitados por fabricantes, modelos propios o generación asistida. Los modelos incorporados tendrán identificación, revisión, unidades y dimensiones declaradas, procedencia y condiciones de uso. Se diferenciará un modelo revisado que representa un producto concreto de una representación genérica u orientativa. Una imagen o una forma generada no acredita la geometría ni las medidas del producto.

Las variantes con distinto tamaño, acabado o precio tendrán una selección inequívoca, enlazada al catálogo. No se mantendrá otra tarifa independiente dentro del visor. El precio de un presupuesto guardado sigue siendo su instantánea: una actualización posterior del catálogo no modifica revisiones cerradas o aprobadas.

## Relación entre escena y presupuesto

Cada elección presupuestada de la escena debe vincularse a una partida y una referencia de artículo, dentro de un proyecto y una revisión concretos. Un suelo puede representar una superficie y varias puertas pueden corresponder a una misma partida de unidades; se necesita una relación explícita, no contar objetos gráficos como si fueran automáticamente unidades facturables.

La escena también puede contener contexto visual que se conserva o no se vende: mobiliario existente, decoración orientativa y elementos del inmueble. Su condición se mostrará al consultarlos; no incrementarán el presupuesto por aparecer en la vista.

Los trabajos sin objeto visible —demolición, preparación, instalación o retirada de residuos— seguirán formando parte del presupuesto. Las actuaciones podrán reunir producto, instalación y trabajos asociados. Se comprobará la composición para no añadir dos veces una instalación que ya incluye el precio del artículo.

Ejemplo: al sustituir el mueble de baño por otra referencia, se propone la nueva representación y el cambio económico. Se comprueban dimensiones, compatibilidad y posibles trabajos asociados. La modificación se incorpora al borrador elegido mediante una acción autorizada y queda comparada con la versión anterior. La revisión aprobada para obra conserva sus elecciones y precios.

Las cantidades de obra proceden de mediciones o supuestos identificados y de las reglas de la actuación. El visor representa esas decisiones; un render generado no se usa como fuente de medidas. Si la escena es orientativa o tiene partes pendientes, se señala en la presentación.

## Escenas y versiones

Una revisión visual conserva la identidad del modelo del inmueble, los recursos/variantes elegidos y su relación con una revisión de presupuesto. Se deben conservar elecciones anteriores, cambios y decisiones del profesional.

Si se modifica el presupuesto o una elección comercial, la escena correspondiente se marca para actualizar o revisar. No se debe presentar una escena antigua como si representase la última oferta. El enlace que se comparta con el cliente identificará la revisión que presenta; una elección del cliente se recibe como solicitud o alternativa hasta su aceptación por GARAL.

El recorrido capturado del estado actual y la reconstrucción de la propuesta se identificarán por separado. La comparación antes/después no debe hacer pasar una reconstrucción por un levantamiento real.

## Secuencia de desarrollo

1. Definir recursos visuales y variantes vinculados a los artículos, sin modificar el contrato económico existente durante el trabajo paralelo de Fable.
2. Preparar una estancia sintética con objetos y materiales de prueba. Comprobar navegación móvil, selección y correspondencia entre elemento y partida antes de abordar reconstrucciones completas.
3. Conectar un modelo espacial procedente de captura o planos, con sus medidas y dudas ya revisadas. Automatizar la colocación y asignación donde haya datos suficientes.
4. Incorporar el cambio de alternativas, comparación económica, revisiones y publicación del recorrido seleccionado en el portal del cliente.

El primer prototipo puede utilizar geometría sencilla y modelos ligeros. La calidad fotográfica y las representaciones comerciales se pueden mejorar después sobre el mismo vínculo artículo-partida-escena. Elegiremos formatos, librería de navegación, procesamiento y límites de almacenamiento con una prueba técnica; no se ha contratado un servicio ni elegido equipo en este documento.

## Coordinación

Esta definición se añade a la rama de captura. Fable puede seguir con el catálogo y las pantallas actuales. La implementación requerirá acordar entidades de recursos/variantes, composición de actuaciones y versiones visuales, más la persistencia de la relación con las partidas. La función económica manual, el resto del CRM y el trabajo de estimación siguen siendo utilizables sin recursos 3D.
