# Reducir la revisión de medidas · criterio de producto

Hugo pide automatizar al máximo y preguntar solo cuando no se puede asegurar el resultado. Este documento define el objetivo; no describe una capacidad ya implementada.

## Dos comprobaciones diferentes

Una longitud puede estar bien calculada sobre el dibujo y representar una dimensión equivocada o desactualizada en la obra. Además, tener metros cuadrados no identifica por sí solo material, altura, sistema constructivo, trabajos ocultos o alcance. Automatizar medidas no equivale a aprobar un presupuesto completo.

## Vía preferida para GARAL

Como dibujan en AutoCAD, investigar una exportación preparada de sus originales junto al PDF: geometría, unidades, capas/tipos, referencias estables y revisión. Ese contrato se desarrollaría y validaría con el equipo técnico de GARAL. Evitaría tener que reconstruir del PDF relaciones que el programa de dibujo ya conoce. Admitir también PDF de terceros y reformas parciales sin CAD.

Si solo llega PDF: exigir dibujo vectorial medible, escala por vista o referencia métrica contrastable y convenciones estables de capas/colores para existente, demolición y obra nueva. Las capas pueden incluirse en EXPORTPDF, pero su presencia no demuestra escala ni significado. No heredar escala por tamaño de papel ni por nombre de archivo. Los planos con varias vistas o escalas necesitan referencias por vista.

## Condiciones antes de admitir un caso sin revisión manual de medidas

- Original y revisión identificados; coordenadas/unidades y escala fiables por vista.
- Clasificación de elementos inequívoca según un protocolo conocido, sin confundir mobiliario, cotas o tramas con tabiques.
- Comprobaciones independientes de escala y coherencia geométrica; detección de duplicados, huecos, recortes, páginas o elementos omitidos. Una cota interpretada por OCR no sirve como única prueba.
- Error medido frente a referencias preparadas por GARAL, con tolerancias acordadas por magnitud y uso. Evaluar casos independientes de los usados para ajustar el motor, incluidos formatos desconocidos, errores de exportación, detalles y escalas mezcladas.
- Reglas explícitas para abstenerse: dato contradictorio, extracción parcial relevante, elemento no reconocido o archivo fuera de los casos validados ⇒ pedir una comprobación concreta y conservar el motivo. No inventar un porcentaje de confianza.
- Registro reproducible: original, escala, algoritmo/versión, reglas, referencias, cantidades y excepciones. Supervisión y posibilidad de corregir sin alterar revisiones aprobadas.

La interfaz objetivo sería «Medidas calculadas» cuando el caso cumpla las garantías acordadas, y preguntas concretas cuando no: «Confirma esta distancia» o «No se ha podido interpretar esta zona». El usuario no tiene que marcar todas las paredes ni comprender la extracción técnica. En el estado actual aún se exige revisión: leer trazos de los 31 PDF privados no valida 31 presupuestos ni su exactitud.

Fuentes primarias consultadas el 2/11/2026: [Autodesk: diferencias PDF/DWG y pérdida de relaciones entre objetos](https://www.autodesk.com/blogs/autocad/pdf-import-guidance-working-with-pdf-and-autocad-dwg-data/), [Autodesk: opciones de exportación y capas](https://help.autodesk.com/cloudhelp/2025/ENU/AutoCAD-Core/files/GUID-36D8C81E-754F-4C7A-844E-3A5A131801D9.htm). La integración y las reglas de aceptación anteriores son una propuesta para PLANO, no una garantía de Autodesk ni una función existente.
