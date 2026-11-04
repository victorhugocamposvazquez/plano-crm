# Visita 360 · tecnología y evolución

Revisado el 5 de noviembre de 2026. La misma información, resumida, está en la zona de superadministración: `/sistema/visita-360`.

## Qué hace

En `/proyectos/[id]/visita360` se recorre una foto 360 por estancia. Por voz o por escrito («pon tarima en la cocina», «pinta las paredes») o tocando la foto, Plano encuentra el suelo, las paredes o el techo, los mide y los pinta con el material del catálogo sobre la luz de la foto. Las partidas pasan al borrador del presupuesto.

## Cadena

| Paso | Qué se usa | Archivo |
|---|---|---|
| Foto | Equirectangular 2:1. Ejemplos de Poly Haven (CC0) en `public/visual/360/`. Fotos propias como documento «360 · Estancia», reducidas a 4096 px | `src/lib/visita360.ts` |
| Visor | three.js 0.186: esfera con la foto y capas por superficie con un shader que multiplica el material por la luz desenfocada de la foto | `src/lib/visor360.ts` |
| Detección por color | Propia, sin modelos: Lab, crecimiento competitivo desde semillas, encuentros con rodapié y moldura por programación dinámica. Respaldo de SAM | `src/lib/autodeteccion.ts` |
| SAM | SAM 2.1 hiera tiny, ONNX de `onnx-community/sam2.1-hiera-tiny-ONNX`, con transformers.js 4.3.2 y onnxruntime-web. WebGPU en fp16; sin WebGPU, procesador con el modelo cuantizado | `src/lib/sam.ts` |
| Vistas planas | Seis vistas de 1024 px: cuatro alrededor a 104° y suelo y techo a 116° | `src/lib/vistas360.ts` |
| Unión | Rejilla de 8 × 8 puntos por vista, un recorte por punto. Cada segmento toma la etiqueta por color de la mayoría de sus píxeles (≥ 60 %) o ninguna. Votos por vista pesados por cercanía al centro y filtro de mayoría de radio 3 | `src/lib/sam360.ts` |
| Toque | Pared: recorte SAM de un punto en la vista más centrada. Suelo y techo: parte conectada de la segmentación | `src/lib/sam360.ts` |
| Medición | Cámara a 1,5 m. Suelo y techo: dA = dΩ·h²/│sen p│³. Paredes: distancia por el rodapié y ancho corregido por orientación. Altura del techo por la moldura | `src/lib/autodeteccion.ts` |
| Órdenes | Web Speech API (es-ES) u orden escrita. Intérprete propio contra el catálogo | `src/lib/visita360.ts` |
| Pantalla | Análisis al abrir cada estancia, retoque con deshacer, ticket por estancia y paso al presupuesto | `src/components/capture/visita-360.tsx` |

Si SAM no carga, falla o reconoce menos de una cuarta parte de la foto, se usa la detección por color y la consola lo explica.

## Licencias y coste

| Pieza | Licencia | Coste |
|---|---|---|
| SAM 2.1 (código y pesos) | Apache 2.0 | Gratis, corre en el navegador del usuario |
| transformers.js | Apache 2.0 | Gratis |
| onnxruntime-web | MIT | Gratis |
| three.js | MIT | Gratis |
| Fotos de ejemplo | CC0 | Gratis |

El modelo pesa unos 77 MB en fp16 y se descarga de Hugging Face la primera vez; queda en la caché del navegador (`transformers-cache`).

## Rendimiento medido

| Caso | Tiempo |
|---|---|
| Mac, Chrome con WebGPU, foto de 2048 px | Unos 8 s la primera vez por foto |
| Solo detección por color | Alrededor de 1 s |
| Sin WebGPU y móviles | Sin medir |

## Límites

- Mide lo visible. El suelo bajo un mueble no cuenta.
- La altura de cámara se supone de 1,5 m.
- El significado de cada segmento viene de la detección por color. SAM afina el borde, no corrige una mesa tomada por suelo.
- Azulejos de pared cuentan como pared. Espejos, cristales y techos inclinados no están resueltos.
- Las zonas se guardan en el navegador hasta pasar al presupuesto.

## Evolución propuesta

1. **Alojar el modelo** en nuestro almacenamiento en lugar de Hugging Face. Basta cambiar la ruta del modelo en `src/lib/sam.ts` (`env.remoteHost` de transformers.js).
2. **SAM 3.1** para pedir «suelo», «ventana» o «puerta» por texto. Licencia SAM de Meta: uso comercial permitido con exclusiones, revisar el texto. Necesita tarjeta gráfica en servidor. El resto de la cadena (vistas, unión, medición) se reutiliza.
3. **Distribución de la estancia** (HorizonNet o similar) para medir lo que tapan los muebles. Comprobar la licencia de los pesos antes de usarlos en producción.
4. **Visitas en el servidor**: tabla con foto, zonas y procedencia de cada partida. Corresponde al backend (Codex).
5. **Modelo de lenguaje** solo para interpretar órdenes libres o la foto. Medir y poner precio sigue siendo determinista.

## Revisar y depurar

- La escena lleva `data-deteccion`, por ejemplo `sam-webgpu 8059ms` o `color 1200ms`.
- Con `?depurar` en la dirección, la consola tiene `window.__v360` con la foto, la segmentación por color, la de SAM, el modelo y las vistas.
- Pruebas: `tests/autodeteccion.test.ts`, `tests/sam360.test.ts`, `tests/visita360.test.ts`.
