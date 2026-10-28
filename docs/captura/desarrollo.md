# Desarrollo del módulo de captura

## Secuencia de entregas

La primera entrega es la medición calibrada y el motor de propuestas, descritos en `README.md`. El criterio de finalización es poder seguir una cantidad hasta su fuente, detectar carencias y demostrar que el cálculo usa el catálogo de la organización. Está implementada sin cambiar el contrato del CRM existente.

La segunda entrega será un laboratorio de lectura de planos: cargar una extracción, presentar el original, calibrar una cota, seleccionar o dibujar un eje/contorno y elegir la actuación. Debe usar los componentes y tokens compartidos, con números legibles y controles accesibles en móvil. El resultado será una previsualización; su persistencia necesita el contrato transaccional descrito en el README.

La tercera entrega abordará reconocimiento asistido: detectar candidatos de muros, huecos y estancias, interpretar la leyenda y comparar planos actual/propuesto alineados. La IA propondrá estructura, no precios inventados. Evaluaremos extracción vectorial más reglas geométricas antes de añadir OCR o visión a toda la página. Las cotas impresas se usarán para comprobar/calibrar cuando se reconozcan con evidencia suficiente.

En paralelo funcional a los planos, la visita usará fotos y voz para proponer actuaciones y preguntas. La captura espacial aportará medidas cuando esté disponible; las cantidades que procedan de una estimación visual conservarán esa condición. El parser de salida de cualquier modelo tendrá el mismo límite y validación que una entrada humana. El contenido de documentos y audios se trata como datos, nunca como instrucciones del sistema o autorización para guardar.

La fase de nube de puntos incorporará trabajadores para normalizar levantamientos y extraer planos/superficies, con artefactos pesados fuera de la petición web. Los formatos de entrada y la retención se decidirán con muestras del equipo elegido. Ninguna importación de escáner o DWG está implementada todavía.

## Captura profesional

Hugo autoriza considerar equipo profesional para estancias grandes y difíciles. No elegimos una marca todavía. La prueba comparará:

- Cobertura de paredes, huecos y zonas ocultas; habitaciones grandes, escaleras y espacios conectados.
- Medidas frente a referencias independientes y repetibilidad entre dos capturas.
- Tiempo de visita, procesamiento, limpieza y corrección posterior.
- Exportación de geometría con unidades, coordenadas, escala y metadatos; asociación con fotografías y estación de captura.
- Funcionamiento sin conexión, licencias y posibilidad de conservar/procesar los originales en nuestra infraestructura.
- Tamaño por expediente, requisitos de procesamiento y coste total, incluyendo formación y trabajo de oficina.

Una cámara 360 es una vía para documentar visualmente el espacio. Si un sistema reconstruye medidas a partir de ella, evaluaremos esa reconstrucción y su calibración; no atribuiremos profundidad medida a una fotografía por su formato. LiDAR móvil, distanciómetro y escáner profesional entran por adaptadores distintos hacia un modelo de mediciones común.

## Investigación con REA

REA es una herramienta de investigación, no una dependencia del CRM. Preguntas para una sesión acotada con un plano sintético conocido:

1. Qué datos pide la aplicación y qué correcciones requiere del operador.
2. Si el resultado es una imagen, malla, representación paramétrica o mediciones estructuradas.
3. Qué procesamiento ocurre en el navegador, con qué bibliotecas y qué datos envía a su servidor.
4. Cómo responde al cambiar una cota, una puerta, un tabique o la escala.
5. Qué exportaciones conservan relaciones, dimensiones y unidades.

Registrar observaciones con evidencia, inferencias y aspectos desconocidos. El código del navegador no revela por sí solo el algoritmo, modelo o instrucciones del servidor. No hay hallazgos REA de Kreo, magicplan o Rendair en esta entrega. La skill está disponible; una consulta de descubrimiento requiere un endpoint CDP explícito para una sesión de navegador seleccionada. No se ha configurado ni modificado el navegador del usuario.

## Evaluación del presupuesto

El piloto tendrá tres familias de casos: reforma parcial sin plano, integral con planos de estado actual/demolición/propuesta y captura nueva con referencias de medida. Se compararán cantidades y partidas del mismo alcance, no una estimación inicial con un presupuesto final que incluya trabajos añadidos.

Medir por separado: error de cantidad, partidas omitidas o duplicadas, correspondencia con artículo, efecto de precios/ajustes y minutos de revisión humana. Una coincidencia en el total puede esconder errores que se compensan entre partidas. Las revisiones de un mismo proyecto no se tratarán como proyectos independientes de evaluación o entrenamiento.

La precisión comercial se fijará después de este piloto. La automatización no debe impedir el presupuesto manual ni convertirse en el centro de todo el CRM.
