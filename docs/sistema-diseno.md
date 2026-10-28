# Sistema de diseño de Plano · Workspace y Grafito

Un solo sistema con dos temas: **Workspace** (claro) y **Grafito** (oscuro). Misma estructura, mismos componentes y mismo comportamiento; solo cambian los tokens de color. Pensado primero para móvil (390 px) y heredado tal cual en tablet y escritorio.

- Tokens en código: [`src/styles/tokens.css`](../src/styles/tokens.css).
- Referencia visual: lienzo *Identidad CRM Reformas*, sección «Sistema de diseño del CRM» (móvil, componentes, escritorio y tablet) y tableros de identidad (logo, color, tipografía).
- Origen del look: exploración «Workspace / Grafito» de Codex (24-10-2026), elegida frente a Yeso, Estudio, Tinta, Porcelana y Terminal.

## 1. Principios

1. **Casi monocromo.** La interfaz se construye con tinta, grises y filetes. El color aparece solo donde significa algo.
2. **El naranja es la firma, no un botón.** Se usa en el punto de la marca, en el punto de la pestaña activa y, como variante opcional, en el botón principal. Nunca en estados de datos.
3. **Superficies sin sombra.** Jerarquía por filetes de 1 px y por dos tonos de superficie (`soft`, `raised`). Las sombras solo en capas flotantes (hoja inferior, diálogo, toast).
4. **Peso 500 como máximo en interfaz.** Los titulares van a 500 con tracking negativo; el 800 queda para la marca (Archivo).
5. **Los estados se leen, no se adivinan.** Siempre texto + punto de 5 px; el color acompaña. En oscuro los acentos suben dos pasos de luz para mantener 4,5:1.
6. **Grafito cambia tono, no estructura.** Ninguna pantalla se rediseña para el oscuro.
7. **Planos, fotos y PDF conservan sus colores originales** en ambos temas.

## 2. Tokens de color

Prefijo `--pl-`. Claro = Workspace, oscuro = Grafito.

| Token | Uso | Workspace | Grafito |
|---|---|---|---|
| `--pl-bg` | fondo de página | `#FFFFFF` | `#191A1C` |
| `--pl-soft` | barra de comando, botón suave, cabecera de panel | `#F6F6F4` | `#222427` |
| `--pl-raised` | avatar, medidor, pestaña activa (Grafito), chip | `#F0F1EE` | `#303236` |
| `--pl-ink` | texto principal, acción por defecto | `#20272D` | `#ECEDEB` |
| `--pl-muted` | texto secundario, iconos | `#697177` | `#A8ADB2` |
| `--pl-faint` | solo decorativo (no para texto de 11 px) | `#858C90` | `#8B9299` |
| `--pl-line` | filetes | `#E5E7E3` | `#36383C` |
| `--pl-strong-line` | borde de botón secundario, foco suave | `#CBD0CB` | `#51575E` |
| `--pl-orange` | firma de marca, punto activo, botón principal (variante) | `#E25A12` | `#FF873F` |
| `--pl-accent-text` | texto naranja sobre fondo | `#AA440D` | `#F7A16E` |
| `--pl-warning` | «Revisar plazo», avisos, pendiente de cobro | `#926022` | `#D4AE79` |
| `--pl-blue` | enlaces, datos técnicos, «pedido realizado» | `#2C5A85` | `#94B2CC` |
| `--pl-action` | fondo del botón principal | `var(--pl-ink)` | `var(--pl-ink)` |
| `--pl-on-action` | texto del botón principal | `var(--pl-bg)` | `var(--pl-bg)` |

Variante naranja del botón principal: `[data-accent="orange"]` cambia `--pl-action` a `--pl-orange` y `--pl-on-action` a `#0B1720`. Es una decisión de producto por pantalla (p. ej. «Nueva visita»), no un ajuste del usuario.

Relación con la identidad corporativa: la Tinta de marca (`#16232E`), el Yeso (`#F3F4F1`) y el Azul plano siguen siendo los colores de la identidad (web, documentos, PDF). En la aplicación se usan los neutros de Workspace/Grafito; el naranja `#E25A12` y el azul `#2C5A85` son los mismos.

## 3. Tipografía

| Rol | Fuente | Tamaño / peso / tracking |
|---|---|---|
| Marca «PLANO■» | Archivo 800 | 21 px en app, −0,065 em, cuadrado de 5 px en `--pl-orange` apoyado en la línea base |
| Título de pantalla | Inter 500 | 28 px, línea 1,16, −0,055 em (Grafito: 25 px) |
| Título de ficha / panel | Inter 500 | 22 px, −0,04 em · 16–17 px, −0,025 em |
| Nombre de obra, botón, campo | Inter 500 / 400 | 15 px, −0,015 em |
| Texto base | Inter 400 | 16 px, línea 1,45 (14 px en listas densas de escritorio) |
| Secundario | Inter 400 | 12 px |
| Etiqueta, meta, pestaña inferior | Inter 400 | 11 px en `--pl-muted` (nunca en `--pl-faint`) |
| Cifras, códigos, contadores | IBM Plex Mono 400/500 | mismo cuerpo que el texto al que acompañan, `tabular-nums` |

Pesos permitidos en interfaz: 400 y 500. El 600 solo en texto de botón sobre naranja si hace falta contraste; el 700/800 nunca fuera de la marca.

Fuentes ya instaladas en el proyecto (`@fontsource-variable/inter`, `@fontsource-variable/archivo`, `@fontsource/ibm-plex-mono`); los nombres de familia que exponen son `"Inter Variable"`, `"Archivo Variable"` e `"IBM Plex Mono"`, y así están en `tokens.css`.

## 4. Medidas

- **Base de espaciado:** 4 px. Escala habitual 4 · 8 · 12 · 16 · 20 · 24 · 32.
- **Radios:** pantalla móvil 24 · panel y campo 10 · botón 10 · botón-icono 8 · pestaña píldora 6 · barra de comando 17 (Grafito 11) · circular para avatar y botón de enviar.
- **Filetes:** 1 px; pestaña activa 1,5 px; medidor de avance 3 px.
- **Táctil:** botones 44 px (38 px en cabecera de escritorio) · campos 46 px · filas de lista ≥ 56 px, filas de obra 90 px en móvil y 60 px en escritorio · navegación inferior 55 px · botón-icono 34–36 px (mínimo 44 px de área activa).
- **Iconos:** trazo 1,55 px, 19 px por defecto; 13–16 px dentro de etiquetas y meta. Conjunto: Lucide (ya en dependencias).

## 5. Navegación por anchura

| Anchura | Navegación | Buscador / comando | Detalle |
|---|---|---|---|
| < 768 (móvil) | barra inferior de 4 pestañas: Hoy · Obras · Agenda · Más; punto naranja de 3 px en la activa | barra de comando sobre la navegación | pantalla completa, hojas inferiores |
| 768–1279 (tablet) | carril de iconos de 72 px a la izquierda (botones de 44 px) | dentro de la columna de lista | lista 420 px + panel de detalle |
| ≥ 1280 (escritorio) | barra lateral de 240 px con texto; «Preguntar a Plano…» y usuario abajo | cabecera de 64 px con ⌘K; acciones a la derecha | lista + panel lateral de atención de 340 px |

Las pantallas son las mismas en los tres anchos; lo que cambia es dónde vive la navegación y cuántas columnas se muestran.

## 6. Componentes

- **Botón principal:** `--pl-action` / `--pl-on-action`, 44 px, radio 10, texto 15/500. Variante naranja por pantalla. Secundario: borde `--pl-strong-line`, fondo transparente. Fantasma: texto en `--pl-blue`. Deshabilitado: fondo `--pl-raised`, texto `--pl-faint`.
- **Campo:** 46 px, borde `--pl-line`, radio 10, etiqueta de 11 px encima en `--pl-muted`. Foco: borde 1,5 px en `--pl-ink`. Aviso: borde y texto de ayuda en `--pl-warning`. Cifras en mono con la unidad a la derecha.
- **Pestañas:** Workspace subrayado 1,5 px en `--pl-ink`; Grafito píldora con fondo `--pl-raised` y radio 6. Contador en mono 11 px.
- **Fila de obra:** icono en caja de 32×36 con borde, nombre 15/500, meta 11, porcentaje en mono a la derecha. El medidor de avance (3 px) solo en paneles y fichas, no en cada fila de móvil.
- **Panel (Grafito y escritorio):** borde `--pl-line`, radio 10, cabecera en `--pl-soft` con etiqueta de 11 px en mayúsculas opcionales.
- **Barra de comando:** fondo `--pl-soft`, borde, placeholder 13 px, contexto 11 px y botón circular de 31 px en `--pl-action`.
- **Ajuste de partida:** slider de 3 px + botones −/+ de 36 px + campo de porcentaje en mono. Arrastrar nunca es la única forma de introducir el valor; el motivo del ajuste se guarda con la partida (`adjustment_percent` y `change_reason` del dominio).
- **Versiones de presupuesto:** chip con borde `--pl-ink` para «Vn · aprobada para obra»; chip con fondo `--pl-raised` para «Vn · en revisión · +Δ €». Siempre visibles juntas en la ficha.
- **Hoja inferior / diálogo:** fondo `--pl-bg` (Grafito `--pl-soft`), asa de 36×4, título 17/500, texto 13 en `--pl-muted`, dos botones a ancho completo. Sombra `0 8px 24px rgba(0,0,0,.08)` (oscuro `.4`).
- **Toast:** fondo `--pl-soft`, borde, punto naranja de 8 px, acción «Deshacer» en `--pl-ink`.

## 7. Estados del dominio → presentación

Siempre texto + punto de 5 px (`currentColor`). Colores:

| Dominio (`src/lib/domain.ts`) | Texto | Color |
|---|---|---|
| `projectStatus.lead` / `estimating` / `planning` | Primera visita · Presupuestando · Planificación | `--pl-muted` |
| `projectStatus.active` | En obra / En curso | `--pl-muted` (el punto en `--pl-blue` si hay que distinguirlo de los anteriores) |
| `projectStatus.completed` | Finalizado | `--pl-muted`, medidor en `--pl-strong-line` |
| aviso de plazo, pendiente de cobro, documento sin validar | Revisar plazo · Pendiente de cobro · Pendiente de validar | `--pl-warning` |
| `versionStatus.approved` | Aprobada para obra | `--pl-ink` (chip con borde) |
| `versionStatus.draft` / `issued` | En revisión · Revisión cerrada | `--pl-muted` (chip con fondo) |
| `versionStatus.superseded` | Aprobación anterior | `--pl-faint` solo en el punto; texto en `--pl-muted` |
| `purchaseStatus.planned` | Por pedir | `--pl-muted` |
| `purchaseStatus.ordered` | Pedido | `--pl-blue` (no el naranja del PDF original) |
| `purchaseStatus.received` | Recibido | `--pl-warning` |
| `purchaseStatus.delivered` | En obra | `--pl-ink` |
| `inclusion.optional` / `excluded` en partidas | Alternativa · Excluida | `--pl-muted` + texto; nunca solo color |

## 8. Accesibilidad

- Contraste mínimo 4,5:1 en todo texto, incluido el de 11 px: por eso `--pl-faint` no se usa para texto.
- Foco visible en todos los controles (borde 1,5 px `--pl-ink` o anillo de 2 px `--pl-strong-line`).
- Objetivos táctiles de 44 px; en escritorio pueden bajar a 38 px en cabecera.
- `color-scheme` declarado por tema para que formularios nativos y barras de scroll sigan al tema.
- Estados nunca por color solo; iconos decorativos con `aria-hidden`.

## 9. Cómo usar los tokens

```tsx
// app/layout.tsx
import "@fontsource-variable/inter";
import "@fontsource-variable/archivo";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@/styles/tokens.css";
```

- Sin atributo, el tema sigue a `prefers-color-scheme`. `<html data-theme="light">` fuerza Workspace y `<html data-theme="dark">` fuerza Grafito; guardar la preferencia del usuario ahí.
- `data-accent="orange"` en el contenedor de una pantalla activa la variante naranja del botón principal.
- Los componentes solo leen variables `--pl-*`; ningún color en hexadecimal fuera de `tokens.css`.

## 2b. Capa semántica y elevación (añadida el 26-10-2026)

El sistema sigue siendo casi monocromo, pero los **estados que cambian decisiones** ganan color propio, siempre con texto al lado:

| Token | Significa | Workspace | Grafito | Dónde |
|---|---|---|---|---|
| `--pl-success` / `--pl-success-bg` | conseguido, en marcha sin problemas | `#2F7D4F` / `#E2F0E7` | `#6CC08A` / `#1B3326` | avance del proyecto, tarea hecha, aprobada para obra, material en obra, proyecto finalizado |
| `--pl-info` / `--pl-info-bg` | en curso, pedido, enlace | = `--pl-blue` / `#E3ECF4` | = `--pl-blue` / `#1C2E40` | «En obra», pedido realizado, revisión cerrada |
| `--pl-warning` / `--pl-warning-bg` | pendiente, revisar | `#926022` / `#F7ECD8` | `#D4AE79` / `#3A2E14` | pendiente de aprobar, recibido sin entregar, avance con plazos vencidos |
| `--pl-danger` / `--pl-danger-bg` | vencido, rechazado, eliminado | `#B83A2E` / `#F6E3E1` | `#E8756B` / `#3E1F1C` | tarea atrasada, entrega pasada, partida eliminada |

- **Medidor de avance** (`.meter[data-tone]`): verde por defecto; ámbar si el proyecto tiene tareas vencidas; rojo si la fecha de entrega ha pasado; el porcentaje toma el mismo color (`.progress-value`).
- **Píldora** (`.pill[data-tone]`): fondo tintado + punto, para listas densas donde el punto solo no basta. El punto + texto (`.status`) sigue siendo la forma por defecto.
- El naranja no entra en esta capa: sigue siendo firma de marca y acción.

**Elevación.** Dos niveles:

| Token | Workspace | Grafito | Uso |
|---|---|---|---|
| `--pl-shadow-1` + `--pl-surface` | sombra muy suave sobre `--pl-bg` | sin sombra; la superficie sube a `--pl-soft` | paneles, tarjetas, líneas de estimación, resúmenes |
| `--pl-shadow-2` | sombra flotante | sombra flotante más densa | hoja inferior, toast, menús |
| `--pl-surface-zone` | `--pl-soft` | `#15171A` (más hundido que el fondo) | **zona** (`.zone`): bloque secundario como el lateral de la ficha; dentro de una zona los paneles no llevan sombra |

Regla: un panel se separa de la página por elevación, una zona agrupa paneles por fondo. No se combinan borde grueso + sombra + fondo en el mismo elemento.

## 10. Navegación y contexto (añadido el 26-10-2026)

Principio: **la pantalla en la que trabajas no se pierde**. Reglas:

1. **Detalle en capa, no en ruta.** Ver una tarea, un documento o un aviso abre un diálogo (`Modal`: hoja inferior en móvil, centrado en escritorio) sobre la pantalla actual; al cerrarlo sigues donde estabas, con el mismo scroll. Solo cambian de ruta las entidades con ficha propia (proyecto, presupuesto, cliente).
2. **El estado de la vista vive en la URL.** Pestaña de la ficha (`?s=`), presupuesto elegido (`?p=`), filtro y búsqueda de listas (`?f=`, `?q=`), vista, día y filtros de la agenda (`?v=`, `?d=`, `?o=`, `?p=`). `useQueryState` sustituye la entrada del historial (no la apila): cambiar un filtro no obliga a pulsar «atrás» diez veces, pero «atrás» desde una ficha devuelve la lista tal como estaba y recargar o compartir el enlace muestra lo mismo.
3. **«Volver» es volver.** `BackLink` usa el historial cuando se viene de dentro de Plano y el destino de respaldo cuando se entra directo. El enlace al proyecto desde un diálogo es una acción explícita («Abrir proyecto»), nunca el comportamiento por defecto de tocar una fila.
4. **Las acciones no te mueven.** Completar una tarea, registrar una recepción o enviar un mensaje actualizan la vista en sitio y lo confirman con el toast; solo «Guardar estimación» navega, porque crea la entidad a la que ir.
5. **Controles propios.** Selectores (`Select`), conmutadores de vista (`.view-toggle`) y segmentos del sistema, no los nativos del navegador: misma altura que los campos, teclado completo, lista con elevación 2.

### Botones de creación

Todo botón que crea algo lleva icono `Plus` (17 px, trazo 1,8) **y** texto «Nuevo/Nueva + sustantivo» («Nuevo proyecto», «Nueva tarea», «Nuevo artículo»): nunca solo el «+». Variante `btn-primary btn-new` en la cabecera de página; mientras el formulario de alta está abierto pasa a `btn-secondary` con `X` y «Cerrar». El alta de proyecto desde oficina abre un `Modal` sobre la lista (`/proyectos?nuevo=1`); «Estimar en la visita» es la otra entrada, no la única.

### Panel de cuenta

El avatar (barra superior en móvil, pie de la navegación en escritorio) abre un `Modal` «Tu cuenta» con nombre, perfil, organización, origen de los datos, el conmutador de tema con texto y «Cerrar sesión» (solo en modo Supabase). No hay botón de salir suelto en el armazón.

### Conmutador de tema

Dos estados, claro ↔ oscuro, sin paso intermedio «sistema»: el primer valor se toma de `prefers-color-scheme` y a partir del primer clic manda `localStorage` (`plano.theme`). El icono muestra el tema actual (sol / luna).

### Editor de partidas y guía por capítulos

Las partidas de la revisión en borrador se editan en un `Drawer` ancho (`size="wide"`, 760 px en escritorio) sin salir de la ficha (`?editar=1`): partidas agrupadas por capítulo con cantidad, unidad, precio, ajuste e inclusión; «Añadir del catálogo» con buscador y chips de capítulo; «Partida libre»; notas; pie con base, IVA y total y «Guardar Vn». Al cerrar con cambios se pide confirmación en el propio pie, nunca con un diálogo nativo.

La guía por capítulos (`guiaPorTipo`) es el guion de una obra según el tipo de proyecto; se muestra al abrir una revisión vacía, cada paso filtra el catálogo por su capítulo y se marca cubierto cuando tiene partidas. «Ir al grano» la oculta; se puede volver a abrir.

### Chips de filtro

`.chip[aria-pressed="true"]` invierte color (tinta sobre fondo) para el filtro activo. En listas largas, `.chips-scroll` desplaza en horizontal sin partir líneas (categorías del catálogo).

### Pantallas transversales

Presupuestos, Clientes, Documentos y Finanzas leen todo el espacio y enlazan a la ficha del proyecto conservando el contexto (`?s=`, `?p=`). Sus filtros van en la URL (`?f=`, `?q=`, `?c=`). Importes siempre en base sin IVA, en mono. «Más» es la puerta de las secciones secundarias en móvil (tarjeta de cuenta, lista de secciones, tema) y repite el menú lateral en escritorio. En Finanzas la tabla se apila en móvil con el nombre de la columna delante de cada cifra (`data-label`).

### Menú contextual

`Menu` (botón «···» + lista propia con teclado y cierre al pulsar fuera) reúne lo que se hace con un objeto y no cabe en su cabecera; cada entrada lleva etiqueta y una línea de ayuda, y las que no aplican se muestran deshabilitadas con el motivo en la ayuda. Las acciones que cambian estado (cerrar revisión, aprobar, nueva revisión, cambiar de fase) confirman siempre en un `Modal` sobre la pantalla, con el dato que el dominio exige (referencia de aprobación, motivo de la revisión).

### Ciclo del presupuesto en la ficha

Bajo las partidas, una fila de acciones según el estado (`accionesPresupuesto`): borrador → «Editar partidas» y «Cerrar Vn»; cerrada → «Aprobar Vn para obra» (oficina y administración) o «Nueva revisión»; aprobada sin borrador → «Nueva revisión». Con aprobada y borrador a la vez, «Ver cambios completos» abre el comparador campo a campo con la diferencia en base.

### Laboratorio de planos · aportación de Codex, 28-10-2026

Ruta independiente `/laboratorio/planos`, fuera del proveedor del CRM: trabaja con una extracción local y un ejemplo sintético. Reutiliza Brand, Button, Select, ThemeToggle y Modal. No se añade al menú ni cambia las pantallas de Fable en esta rama. Nuevo token `--pl-document-bg`, blanco fijo en ambos temas, para que los trazados del original sigan siendo legibles sobre papel en Grafito.

El plano mantiene sus colores originales como datos del documento; las superposiciones de medición usan `--pl-blue`. Una lista textual acompaña a las propuestas: pendiente, incluida en revisión o descartada. La selección de referencia mediante dos pulsaciones tiene alternativa con campos de coordenadas. Cada página conserva escala, leyenda y decisiones; cambiar una referencia reabre su revisión. Cambiar de archivo con decisiones abiertas permite descargarlas antes, con confirmación sobre la pantalla. El laboratorio descarga una revisión local y no ofrece acciones de guardar/aprobar presupuestos.

### Prototipo de espacio navegable · 28-10-2026

Ruta independiente `/laboratorio/espacio`, con ejemplos ficticios de local y nave. Controles táctiles de vista, giro y acercamiento, selección alternativa por lista y catálogo propio de la demostración. La propuesta económica distingue base, IVA y diferencia frente al ejemplo inicial, y muestra «En preparación · propuesta local» y ausencia de revisión aprobada vinculada.

La escena conserva los colores RGB de sus materiales y utiliza `--pl-document-bg` como fondo; los modelos son contenido visual, no estados de la interfaz. La selección se señala en azul y con texto en la lista. La ficha del artículo permite cambiar la alternativa sin abandonar el espacio. Si falta WebGL, la ficha y los cálculos siguen disponibles. No se añade esta ruta al menú de producción ni se cambia la navegación de Fable.
