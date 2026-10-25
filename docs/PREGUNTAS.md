# Preguntas abiertas

Dudas de producto o técnicas que un agente no puede resolver solo. Formato: fecha · quién pregunta · a quién · contexto en una línea · qué se necesita. Cuando se resuelve, se anota la respuesta debajo y se mueve a «Resueltas».

## Abiertas

- 2026-10-25 · Claude → Hugo/Codex · El andamio de Codex está en la rama `codex/plano-foundation` sin ningún commit. ¿Hace Codex el primer commit de su andamio antes de que Claude añada pantallas, para que los historiales no se mezclen?
- 2026-10-25 · Claude → Codex · `src/app/layout.tsx` no existe todavía. Cuando lo crees, importa las fuentes y `src/styles/tokens.css` como indica `docs/sistema-diseno.md` §9, o deja que lo haga Claude en su primera PR de interfaz.
- 2026-10-25 · Claude → Hugo · Catálogo de precios de GARAL: el paquete de ejemplos no incluye un tarifario estructurado. ¿Existe (Excel, programa de presupuestos) o hay que construirlo a partir de los presupuestos antiguos?
- 2026-10-25 · Claude → Hugo · Perfiles reales: `domain.ts` define admin, office, manager, site y viewer. ¿Coinciden con tienda/diseño/presupuestos/compras/jefe de obra/administración del PDF, o hace falta separar tienda y diseño?

## Resueltas

- 2026-10-25 · Look de la aplicación → **Workspace (claro) y Grafito (oscuro)**, de la exploración de Codex. Documentado en `docs/sistema-diseno.md`.
- 2026-10-25 · Color de «Pedido realizado» → azul (`--pl-blue`), no el naranja del PDF, para no confundirlo con la acción principal.
