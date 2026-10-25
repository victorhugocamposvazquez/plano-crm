# Plano · guía para los agentes

Plano es el CRM de reformas de GARAL: una sola ficha por obra, desde la primera visita hasta el cobro final. Lo desarrollan dos agentes sobre este mismo repositorio: **Codex** (GPT) y **Claude Code**. Este archivo es el acuerdo entre ambos; `CLAUDE.md` lo complementa para Claude. Hugo decide; los agentes proponen.

Stack: Next.js 16 · React 19 · TypeScript · Supabase (Postgres, Auth, Storage) · Vercel · Vitest · Playwright. Todo el texto de interfaz, documentación y commits va en español.

## Fuentes de verdad

| Qué | Dónde |
|---|---|
| Alcance funcional | `~/Downloads/Propuesta_CRM_GARAL.pdf` y las notas de Hugo resumidas en `docs/` (pendiente de exportar) |
| Ejemplos reales (10 proyectos: planos, presupuestos, hojas de pedido, vídeos) | `/private/tmp/plano-garal-ejemplos` (inventario en `inventario.json`) |
| Modelo de dominio y comandos | `src/lib/domain.ts` |
| Sistema de diseño | `docs/sistema-diseno.md` y `src/styles/tokens.css` |
| Identidad corporativa (logo, color, tipografía) | lienzo «Identidad CRM Reformas» (Claude) · resumen en `docs/sistema-diseno.md` |
| Dudas de producto sin resolver | `docs/PREGUNTAS.md` |

Si algo no está en estas fuentes, no se inventa: se anota como pregunta en `docs/PREGUNTAS.md` y se sigue con lo que sí está claro.

## Reparto de áreas

**Codex** es responsable de:
- Modelo de datos, migraciones y políticas RLS en Supabase; autenticación y permisos por rol (`Role` en `domain.ts`).
- API y comandos (`src/app/api/**`, `applyCommand`, validación con zod), almacenamiento de archivos, importación del NAS.
- Motor de cálculo de presupuestos (partidas, ajustes, versiones, comparación) y su lógica de negocio.
- Integraciones de servicio: SMS/notificaciones, exportación PDF, transcripción de voz, análisis de planos.
- Infraestructura: Vercel, variables de entorno, CI, `npm run check`.

**Claude Code** es responsable de:
- Sistema de diseño: `src/styles/tokens.css`, `docs/sistema-diseno.md`, componentes base de interfaz (`src/components/ui/**`).
- Pantallas y flujos de usuario (`src/app/**` salvo `api/`): obras, ficha de obra, presupuestos con versiones y comparador, estimación rápida en la visita, documentos y chat, agenda, económico.
- Identidad corporativa, logotipo en SVG, favicon, plantillas de documentos (presupuesto, hoja de pedido).
- Accesibilidad y comportamiento responsive (móvil → tablet → escritorio).

**Compartido** (quien lo necesite lo cambia, avisando en el PR): `src/lib/domain.ts` (los tipos los propone Codex; Claude añade solo etiquetas de presentación), `src/lib/demo.ts`, `docs/`, tests.

Regla simple: **cada uno toca sus carpetas**. Si necesitas algo del área del otro, deja el cambio mínimo que te desbloquea y descríbelo en el PR, o anótalo en `docs/PREGUNTAS.md`. Nunca reescribas un archivo del otro sin que esté en una PR.

## Reglas de interfaz (obligatorias para ambos)

1. **Solo tokens.** Ningún color en hexadecimal, ningún tamaño de fuente ni radio «a mano» fuera de `src/styles/tokens.css`. Todo componente lee variables `--pl-*`. Si falta un token, se añade al archivo y se documenta en `docs/sistema-diseno.md` en el mismo PR.
2. **Dos temas, una estructura.** Workspace (claro) y Grafito (oscuro) comparten pantallas y componentes; se cambia con `data-theme`, nunca con componentes distintos.
3. **El naranja es la firma.** Solo en la marca, el punto de la pestaña activa y la variante `data-accent="orange"` del botón principal. Nunca para estados de datos; «Pedido» va en `--pl-blue`.
4. **Estados por texto + punto.** Las etiquetas salen de `domain.ts` (`projectStatus`, `versionStatus`, `purchaseStatus`); el color acompaña según la tabla de `docs/sistema-diseno.md` §7.
5. **Móvil primero.** Toda pantalla funciona a 390 px antes de pensar en escritorio; objetivos táctiles de 44 px; controles reales (`button`, `a`, `input` + `label`), nada de `div` con `onClick`.
6. **Versiones de presupuesto siempre visibles.** Donde aparezca un presupuesto se distingue «aprobada para obra» de «en revisión» y se muestra la diferencia económica.
7. **Información comprobada ≠ propuesta automática ≠ pendiente.** Lo que calcule la IA o se extraiga de un plano, vídeo o albarán se marca como propuesta hasta que una persona lo valide.
8. Copy en español, directo, sin anglicismos innecesarios; cifras con formato `es-ES` (`money`, `dateLabel` de `domain.ts`).

## Flujo de trabajo en git

- Rama principal: `main`. Ramas de trabajo: `codex/<tema>` y `claude/<tema>`. Nadie hace commit directo en `main`.
- PRs pequeñas (una pantalla, una migración, un componente). Título en español, descripción con qué cambia y cómo probarlo. Cada agente revisa las PRs del otro cuando Hugo lo pida.
- Antes de pedir revisión: `npm run check` (typecheck + tests + build) en verde.
- Commits en español, en imperativo: «Añadir comparador de versiones», «Crear tabla de certificaciones».
- No se suben secretos; `.env.example` documenta cada variable.
- Los archivos de ejemplo de GARAL no se copian al repositorio (datos de clientes reales); se referencian por ruta.

## Cómo pedirle algo al otro agente

Escribe en `docs/PREGUNTAS.md` o en la descripción de la PR, nunca en comentarios de código. Formato: contexto en una línea, qué necesitas, por qué te bloquea. Hugo traslada lo que haga falta al otro chat.
