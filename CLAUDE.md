# Plano · notas para Claude Code

Lee primero `AGENTS.md`: ahí está el reparto de áreas con Codex, las reglas de interfaz y el flujo de git. Este archivo solo añade lo que afecta a Claude.

## Tu área

Sistema de diseño (`src/styles/tokens.css`, `src/components/ui/**`, `docs/sistema-diseno.md`), pantallas y flujos (`src/app/**` salvo `api/`), identidad y plantillas de documentos, accesibilidad y responsive. El backend, Supabase, la API y el motor de cálculo son de Codex: léelos, no los reescribas.

## Antes de empezar una tarea

1. `git status` y `git log --oneline -10`: comprueba en qué rama estás y si Codex ha dejado cambios sin commit. Si hay archivos suyos sin versionar, no los toques y díselo a Hugo.
2. Lee `src/lib/domain.ts`: los tipos, estados y comandos salen de ahí. Si una pantalla necesita un dato que no existe, anótalo en `docs/PREGUNTAS.md` en lugar de inventarlo en el cliente.
3. Trabaja en una rama `claude/<tema>`.

## Al construir interfaz

- Solo variables `--pl-*`. Si necesitas un valor nuevo, añádelo a `tokens.css` y a `docs/sistema-diseno.md` en el mismo cambio.
- Prueba cada pantalla a 390 px, 768 px y 1280 px, y en los dos temas (`data-theme="light"` / `"dark"`).
- Los componentes base viven en `src/components/ui/` y no conocen el dominio; las pantallas los componen.
- Iconos de Lucide (`lucide-react`), trazo 1,55, 19 px por defecto.
- Marca en interfaz: clase `.pl-brand` («PLANO■»), nunca una imagen.
- Textos literales en español dentro del JSX; nada de claves de traducción por ahora.

## Al terminar

- `npm run check` en verde.
- Commit en español e imperativo; abre PR contra `main` con cómo probarlo.
- Si el cambio toca algo del área de Codex, dilo en la primera línea de la descripción.

## Referencias

- Lienzo de identidad y sistema (Design artifact): «Identidad CRM Reformas».
- Prototipo de looks de Codex del que salen los tokens: `~/.codex/visualizations/2026/10/24/01a16d5d-37bd-7d21-a47f-8c7d7151362e/plano-premium-looks.html`.
- Ejemplos reales de GARAL: `/private/tmp/plano-garal-ejemplos` (no copiar al repo).
