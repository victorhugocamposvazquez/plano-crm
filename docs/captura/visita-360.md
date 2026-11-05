# Visita 360 · tecnología y evolución

Revisado el 5 de noviembre de 2026. La misma información, resumida, está en la zona de superadministración: `/sistema/visita-360`.

## Qué hace

En `/proyectos/[id]/visita360` se recorre una foto 360 por estancia. Por voz, por escrito o tocando la foto se dice qué va («pon tarima en la cocina», «pinta las paredes», «pon dos puertas») y cuánto mide la estancia («la cocina mide 4 por 3 y 2,6 de alto»). Plano calcula suelo, paredes y techo con esas medidas y pasa las partidas al borrador del presupuesto.

La foto sirve para situarse y marcar dónde va cada cosa. **No se mide ni se pinta sobre la foto.**

## Cadena

| Paso | Qué se usa | Archivo |
|---|---|---|
| Foto | Equirectangular 2:1, una por estancia. Ejemplos de Poly Haven (CC0) en `public/visual/360/`. Fotos propias como documento «360 · Estancia», reducidas a 4096 px | `src/lib/visita360.ts` |
| Visor | three.js 0.186: esfera con la foto, arrastrar, ampliar, tocar y proyectar las marcas | `src/lib/visor360.ts` |
| Medidas | Dichas, escritas o en el formulario «Medidas». Decimales con coma, palabras («dos sesenta») y centímetros | `src/lib/medidas.ts` |
| Cantidades | Suelo y techo = largo × ancho. Paredes = perímetro × alto − 1,64 m² por puerta − 1,44 m² por ventana. Rodapiés = perímetro − 0,80 m por puerta | `src/lib/medidas.ts` |
| Órdenes | Web Speech API (es-ES) u orden escrita. Intérprete propio contra el catálogo | `src/lib/visita360.ts` |
| Simular la vista | Gemini (API Interactions, `gemini-nano-banana-2.1` por defecto): vista capturada + materiales de la estancia + muestras como referencia. Clave `GEMINI_API_KEY` solo en servidor, 20 por persona y hora | `src/lib/simulacion.ts`, `src/app/api/simulacion/route.ts` |
| Pantalla | Marcas, medidas por estancia, ticket por estancia y paso al presupuesto | `src/components/capture/visita-360.tsx` |

Una cantidad dicha manda sobre la calculada. Sin medidas, la cantidad queda provisional (≈) y se recalcula al medir. Si cambian las medidas, se recalcula lo que salía de ellas.

## Licencias y coste

| Pieza | Licencia | Coste |
|---|---|---|
| three.js | MIT | Gratis |
| Fotos de ejemplo | CC0 | Gratis |
| Intérprete de órdenes y medidas | Propio | Gratis |
| Medidor láser | — | Un medidor básico |
| Gemini, edición de imagen | De pago (Google) | ~0,034 $ por imagen a 1K |

## Qué se probó y se descartó

- **Medir y pintar desde la foto (PR 91 y 92, 4 y 5 nov 2026).** Primero marcando esquinas; después con detección propia por color y SAM 2.1 en el navegador. Las medidas dependían de suponer la cámara a 1,5 m y los bordes salían en escalones al pintar materiales. Se retiró. El código está en el historial de git.
- **SAM 3 y 3.1.** Acceso aprobado a mano por Meta y licencia propia con exclusiones. No resuelve la medida ni el pintado.
- **Modelos de planta desde una foto 360 (HorizonNet y similares).** Pesos entrenados con datos de uso académico; Zillow indica que ZInD no se licencia para fines comerciales.

## Evolución propuesta

1. **Simular la vista con IA: hecho (5 nov 2026).** Sin nivel gratuito: unos 3–7 céntimos por imagen. Falta medir la calidad con fotos reales de GARAL y decidir el modelo.
2. **Guardar la visita en el servidor**: fotos, medidas, marcas y procedencia de cada partida. Backend (Codex), con migración.
3. **Escaneo LiDAR (opcional).** Apple RoomPlan en iPhone o iPad Pro. Exige app nativa y dispositivo con LiDAR. Probar antes contra el metro.
4. **Matterport con cámara 360 (opcional).** Medidas automáticas con su app; precisión y precios por comprobar.

## Revisar

- Marcas y medidas en `localStorage`: `plano.visita360.<proyecto>` y `plano.visita360.<proyecto>.medidas`.
- Pruebas: `tests/medidas.test.ts` y `tests/visita360.test.ts`.
