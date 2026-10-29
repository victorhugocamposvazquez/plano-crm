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
| Marca «PLANO■» | Archivo 800 | 21 px en app, −0,065 em, cuadrado de 5 px en `--pl-orange` apoyado en la línea base · favicon/PWA: «PLA» / «NO■» en blanco sobre Tinta `#16232E`, cuadrado `#F2793A` (`src/lib/brand-icon.tsx`, `src/app/icon.tsx`, `apple-icon.tsx`, `manifest.ts`) |
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
- **Radios:** pantalla móvil 24 · panel y campo 10 · botón 10 · botón-icono 8 · pestaña píldora 6 · barra de comando 17 (Grafito 11) · circular para avatar (36 px, iniciales 12 px) y botón de enviar.
- **Campos en móvil:** el texto de `input` / `select` / `textarea` es siempre ≥ 16 px (`--pl-text-base`) para que iOS no haga zoom al enfocar.
- **Filetes:** 1 px; pestaña activa 1,5 px; medidor de avance 3 px.
- **Táctil:** botones 44 px (38 px en cabecera de escritorio) · campos 46 px · filas de lista ≥ 56 px, filas de obra 90 px en móvil y 60 px en escritorio · navegación inferior 48 px de ítem (`--pl-nav-bar` 52 px + `safe-area-inset-bottom`, sin padding extra bajo los iconos) · botón-icono 34–36 px (mínimo 44 px de área activa).
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
- **Campo:** 46 px, borde `--pl-line`, radio 10, etiqueta de 11 px encima en `--pl-muted`; texto del control 15 px en escritorio y 16 px en móvil (anti-zoom de iOS). Foco: borde 1,5 px en `--pl-ink`. Aviso: borde y texto de ayuda en `--pl-warning`. Cifras en mono con la unidad a la derecha.
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

## 11. Documentos para el cliente e identidad de la organización

Plano es SaaS: la identidad que ve el cliente en los documentos es la de **cada organización**, no la de Plano. Se configura en «Identidad de la empresa» (`/configuracion/identidad`, oficina y administración): nombre comercial, razón social, CIF, dirección y contacto; logo (PNG/SVG, ≤ 300 KB; sin logo, el nombre hace de marca); color principal y de acento (paleta sugerida o cualquier hex, con contraste automático del texto); portada opcional con frase e imagen; condiciones generales y línea del pie. Modelo en `src/lib/branding.ts`; hoy se guarda en el navegador por organización hasta que el dominio tenga `organization.branding`.

Los documentos (`src/components/documents/*`) se abren en la ruta `(print)` sin armazón, siempre en claro, A4 con `@page`, y se guardan en PDF con «Imprimir». Toman los colores por variables `--doc-primary`, `--doc-accent`, `--doc-on-primary`. Plano solo aparece como «Hecho con PLANO■» en el pie, pequeño. El borrador se marca como tal y sin validez como oferta; la revisión cerrada o aprobada lleva cajas de firma y, si procede, la referencia de aceptación.

La **hoja de pedido** (`/imprimir/pedido/<proyecto>?p=<proveedor>`) usa la misma identidad y maqueta: proveedor, obra y dirección de entrega, líneas con cantidad y estado (nuevo pedido / ya pedido), columna en blanco para plazo y observaciones, instrucciones de entrega y firmas de ambas partes. Se abre desde la lista de materiales del proyecto, un botón por proveedor con pendientes.

**Presentación por presupuesto** (botón «Presentación» en la vista de impresión): logo del cliente (portada y junto a sus datos), imagen de portada propia que sustituye a la de la empresa, título de portada y carta de presentación en la primera página. El documento numera capítulos (01, 02…) y partidas (01.03) y, con más de un capítulo, abre con un resumen por capítulos con barras proporcionales en el color principal.

### Edición del catálogo · 29 octubre 2026

Los artículos se editan y se dan de baja desde la propia lista: cada fila es un botón que abre un `Modal` «Editar · CÓDIGO» con los mismos campos que el alta (categoría, código, descripción, unidad, precio sin IVA, IVA); «Dar de baja» confirma en el propio pie del diálogo. Comandos `article.update` (solo los campos enviados, sin repetir referencia) y `article.delete` en `domain.ts` y en la migración `202610290001_article_update.sql` (área de Codex, mismo patrón que `task_update`). Los precios ya copiados a un presupuesto no cambian.

Las categorías existen a través de sus artículos, así que el campo «Categoría» es un `Select` con las existentes y la opción «Nueva categoría…», que cambia a un campo de texto; el botón «Nueva categoría» de la cabecera abre el alta directamente en ese modo, con una línea que explica que la categoría nace con su primer artículo.

### Para gente que no usa apps · segunda pasada, 29 octubre 2026

Tres reglas que salen del tablero «Segunda pasada» del lienzo «Usabilidad Plano»:

- **Habla como la obra.** Nada de «revisión», «inclusión», «ajuste», «base» ni «peso»: «Terminar la V2 para enviarla», «¿Entra en el precio?», «Recargo o descuento», «Sin IVA», «Cuánto cuenta en el avance». Si una palabra necesita explicación, va en una línea debajo, no en un tooltip. Las notas de hoja de ruta («llegará con el dominio») no se enseñan en la interfaz: van a `docs/PREGUNTAS.md`.
- **Enseña al hacer.** Un vacío dice qué es en una frase y ofrece el primer paso (`.empty` con botón, o `.empty-line` con un enlace en línea): «Sin tareas este día · Planificar una tarea para este día», «El catálogo está vacío · Añadir el primer artículo». Las secciones vacías del chat dicen qué aparecerá ahí.
- **Perdona los errores.** `notify(mensaje, { label: "Deshacer", run })` añade un botón al aviso durante siete segundos para lo reversible: completar o reabrir una tarea, moverla de día, quitar los filtros de la agenda. Lo irreversible (dar de baja, terminar una versión, eliminar) confirma con el nombre de lo que se va a tocar.
- **Navegación por perfil** (`src/lib/navegacion.ts`, `veSeccion`): el equipo de obra ve Hoy, Proyectos, Agenda y Más (con Compras y Documentos); jefe de obra y consulta ven todo menos la configuración de la empresa; oficina y administración, todo. Los permisos reales siguen en `can()`; esto solo ordena el menú y la pantalla «Más».

### Importación del catálogo

«Importar CSV» en Catálogo abre un cajón ancho en tres pasos: pegar o subir el CSV (separador detectado, cabecera reconocida), revisar el mapeo de columnas con el selector propio y la tabla de filas con su estado (entra / ya existe / error con motivo), e importar en lote con barra de progreso. Nada se guarda hasta el último paso y las filas con problemas nunca se importan a medias. «Exportar CSV» devuelve el catálogo en el mismo formato (punto y coma, coma decimal, UTF-8 con BOM) para editarlo en Excel y volver a importarlo. Lógica en `src/lib/importar-catalogo.ts`.

### Revisión de usabilidad (octubre 2026)

- Toda fila que se desplaza en horizontal en móvil (pestañas, pasos, chips) lleva un degradado en el borde derecho que avisa de que hay más; el paso actual de la visita se desplaza solo a la vista.
- Las cifras de la ficha pasan a una por fila por debajo de 640 px (etiqueta a la izquierda, importe a la derecha), los chips de versión se apilan por debajo de 480 px y la fila de acciones del presupuesto se reparte en dos columnas con el botón principal abajo a todo el ancho.
- Los filtros de la agenda van en dos columnas en móvil.
- Foco visible con teclado (anillo azul) en botones, enlaces, pestañas y opciones de menú.
- El acceso rápido de la barra superior es un «+» en círculo con el color de acción.
- «Primeros pasos» en Hoy para una organización nueva (`src/lib/primeros-pasos.ts`): identidad, catálogo, primer proyecto y primer presupuesto, con enlace a cada pantalla; se oculta al completarse, al pasar de tres proyectos o a mano.
- Segunda pasada: el carril de tablet mostraba solo el recuadro del elemento activo, sin iconos (la regla que oculta las etiquetas ocultaba también el icono); corregido. La lista de proyectos en escritorio gana jerarquía: título con código, columna «Tipo» en vez de una «Fase» que repetía el estado, fila con hover. En el chat, Enter envía y Mayús+Enter hace salto de línea.

## 12. Qué toca ahora, buscador global y chat

- **Siguiente paso** (`src/lib/siguiente-paso.ts`): cada proyecto tiene una fase visible (Visita → Presupuesto → Aprobación → Obra → Entrega) y una sola acción principal deducida de su estado real (presupuesto, tareas, certificaciones). En la ficha va arriba, con la línea de fases y un botón primario que ejecuta la acción sin salir de la pantalla; en Hoy, «Qué toca en cada proyecto» lista las más urgentes. Si el proyecto ya está en planificación u obra, manda la obra aunque el presupuesto siga en revisión.
- **Buscador global** (`⌘K` / `Ctrl+K`, lupa en la barra y en el menú): proyectos, clientes, presupuestos, documentos, artículos, acciones y pantallas (`src/lib/buscador.ts`), con teclado. En móvil ocupa la pantalla.
- **Chat**: bloques por autor con avatar de iniciales y tono estable, burbujas (las propias a la derecha en color de acción), separadores «Hoy / Ayer / fecha», compositor redondeado con `#`, adjuntar (deshabilitado hasta que el dominio lo permita) y botón de enviar en naranja. Enter envía, Mayús+Enter salto de línea. El fondo del hilo es `--pl-raised` para separarlo del resto del cajón.
- Chat: cada mensaje propio tiene un menú pequeño (editar, borrar) que aparece al pasar el ratón o siempre en táctil; la edición es en la propia burbuja (Enter guarda, Esc cancela) y queda marcada «editado»; el borrado deja una burbuja punteada «Mensaje eliminado» para que se note el hueco. Oficina y administración pueden borrar mensajes ajenos.
- Línea de fases: ocupa todo el ancho del bloque; pista continua de centro a centro del primer y último punto, con el tramo hecho en verde (`--progress`); en móvil se ocultan las etiquetas y se muestra «Fase n de 5 · Nombre».
- La visita tiene «Cerrar» en la cabecera: vuelve al proyecto del que salió (o a la lista) y, si hay fotos, alcance o partidas sin guardar, pide confirmación.
- Chat: el clip del compositor adjunta una foto o un PDF (se guarda en Documentos del proyecto, fotos en «durante la obra») y lo enlaza en el mensaje; las fotos se pintan como miniatura dentro de la burbuja y abren el archivo. Las reacciones se eligen desde un selector de seis emojis junto al menú del mensaje y se muestran como pastillas bajo la burbuja, con la propia marcada; pulsar una pastilla la alterna.
- Diálogo de tarea: además de completar o reabrir, «Mañana» y «+1 semana» posponen con un clic, «Editar» cambia título, oficio, responsable, fecha y peso en el propio diálogo, y «Eliminar» pide confirmación en el mismo lugar (botón rojo). Lo que el perfil no puede hacer no aparece, con una línea que lo explica.
- Adjuntos del chat: pulsar una miniatura o un chip de documento abre una previsualización en grande dentro de la app (`dialog.lightbox`: foto a tamaño completo o PDF incrustado, con «Abrir aparte» y «Descargar»), nunca una pestaña nueva por defecto.
- Cabecera del chat (`.chat-top`): pila de avatares con el número y los nombres de los participantes (pulsarla abre la información), lupa que despliega la búsqueda en la conversación (`src/lib/chat-busqueda.ts`: filtra sin acentos, resalta con `<mark>` y cuenta coincidencias), icono de información (participantes con recuento y último mensaje, fotos en rejilla, documentos, presupuestos/tareas/compras/clientes/proyectos mencionados y enlaces, todo abrible desde ahí) y «?» con la ventana «Atajos del chat». Se eliminó la línea de ayuda bajo el compositor: la interfaz debe explicarse sola y la ayuda vive en «?».
- Selector `#` en dos niveles (`src/lib/chat-refs.ts`): al escribir `#` aparece la rejilla de categorías (Presupuesto, Documento, Tarea, Compra, Cliente, Proyecto) con el recuento de cada una; al elegir una se busca dentro de ella (con «‹ volver» y Retroceso para salir), y si se sigue escribiendo sin elegir se busca en todo con el grupo como pista. Teclado completo: flechas, Enter/Tab, Esc.
- Atajos `/` (`src/lib/chat-comandos.ts`): un diccionario de consultas con varias formas cada una (`/presupuesto` = «ver último presupuesto» = «último presupuesto»…). Al escribir `/` se listan con su descripción; al escribir la frase tal cual aparece una banda «Enter consulta …» con «Enviar como mensaje» por si se quería escribir eso. La respuesta es una tarjeta efímera (`.msg-system`, solo la ve quien pregunta, no se guarda) con título, líneas y botones de acceso directo (ficha, PDF, tarea, documento, búsqueda). Añadir un atajo = añadir una entrada al diccionario; la ayuda se genera de él.
- En táctil, el menú de cada mensaje (reaccionar, ···) se sitúa en la fila inferior de la burbuja, junto a la hora, en lugar de flotar sobre el texto.
- `Modal`, `Drawer`, la paleta y el visor de adjuntos solo cierran cuando el evento `close` es del propio `<dialog>`: React propaga `onClose` de un diálogo anidado al contenedor, y cerrar la ayuda con Esc cerraba también el chat.
- Consultar desde el chat no saca del chat: el presupuesto se abre en el propio panel (`BudgetPeek`, `src/components/project/budget-peek.tsx`) con estado, importes, diferencia respecto a la aprobada, partidas por capítulo, alternativas y notas; se cambia de revisión con chips V1/V2 y se vuelve con «Volver al chat» (la respuesta del atajo sigue ahí). «PDF» abre aparte e «Ir a la ficha» es una decisión explícita al pie. Los chips `#presupuesto` de los mensajes y las acciones de `/presupuesto`, `/aprobado` y `/versiones` abren esa vista. Principio: lo que se consulta desde una conversación se responde encima de ella; navegar es siempre un botón que lo dice.
- Consultas del chat en modal (`ChatPeek`, `src/components/project/chat-peek.tsx`): cualquier consulta («/», frase o acceso rápido) abre un `Modal size="wide"` encima de la conversación con lo mismo que se vería en la ficha: presupuesto (partidas, importes, cambio de revisión), revisiones, documento del presupuesto pintado con `BudgetDocument` (no en iframe: la cabecera `X-Frame-Options: DENY` lo impide y no se relaja), tareas con `TaskRow` (se marcan desde ahí), compras con `PurchasesPanel`, documentos con `DocumentsPanel`, cliente y «Cómo va» con `NextStep`, avance e importes. Al pie, «Ir a la ficha» explícito y «Volver al chat». Las tarjetas efímeras anteriores desaparecen: la respuesta es siempre la vista completa.
- Accesos rápidos del chat (`.chat-quick`): fila de chips sobre el compositor (Presupuesto, Tareas, Compras, Documentos, Cliente, Cómo va) que salen de los comandos con `acceso` en `chat-comandos.ts`. Es la entrada para quien no conoce «/»; escribir sigue valiendo para quien lo prefiera.
- Vocabulario para no expertos: «#» es **mencionar** algo del proyecto (no «enlazar»), «/» es **consultar**, y la ayuda se titula «Cómo se usa el chat». La ayuda explica para qué sirve mencionar: ser concreto cuando hay varios presupuestos, documentos o tareas; no hace falta para hablar.
- Cajón del chat: el título es el nombre del proyecto en seminegrita (`--pl-weight-semibold`, nuevo token 600, también para títulos de modales) y «Chat del proyecto · código» pasa al subtítulo.
- Favicon e iconos PWA (`src/lib/brand-icon.tsx`, `src/app/icon.tsx`, `apple-icon.tsx`): «PLA» y debajo «NO■» en Archivo 800 sobre la Tinta de marca (`#16232E`, el fondo del icono de app en el lienzo de identidad), texto blanco y el cuadrado en `#F2793A`, el naranja que la identidad fija sobre Tinta. La fuente se incrusta desde `src/lib/fonts/archivo-latin-800-normal.woff` (OFL, licencia junto al archivo) porque el generador de imágenes no lee WOFF2; los iconos se prerenderizan en la build. El fondo del manifiesto PWA pasa a la misma Tinta.
### Laboratorio de planos · aportación de Codex, 28-10-2026

Ruta independiente `/laboratorio/planos`, fuera del proveedor del CRM: trabaja con una extracción local y un ejemplo sintético. Reutiliza Brand, Button, Select, ThemeToggle y Modal. No se añade al menú ni cambia las pantallas de Fable en esta rama. Nuevo token `--pl-document-bg`, blanco fijo en ambos temas, para que los trazados del original sigan siendo legibles sobre papel en Grafito.

El plano mantiene sus colores originales como datos del documento; las superposiciones de medición usan `--pl-blue`. Una lista textual acompaña a las propuestas: pendiente, incluida en revisión o descartada. La selección de referencia mediante dos pulsaciones tiene alternativa con campos de coordenadas. Cada página conserva escala, leyenda y decisiones; cambiar una referencia reabre su revisión. Cambiar de archivo con decisiones abiertas permite descargarlas antes, con confirmación sobre la pantalla. El laboratorio descarga una revisión local y no ofrece acciones de guardar/aprobar presupuestos.

### Prototipo de espacio navegable · 28-10-2026

Ruta independiente `/laboratorio/espacio`, con ejemplos ficticios de local y nave. Controles táctiles de vista, giro y acercamiento, selección alternativa por lista y catálogo propio de la demostración. La propuesta económica distingue base, IVA y diferencia frente al ejemplo inicial, y muestra «En preparación · propuesta local» y ausencia de revisión aprobada vinculada.

La escena conserva los colores RGB de sus materiales y utiliza `--pl-document-bg` como fondo; los modelos son contenido visual, no estados de la interfaz. La selección se señala en azul y con texto en la lista. La ficha del artículo permite cambiar la alternativa sin abandonar el espacio. Si falta WebGL, la ficha y los cálculos siguen disponibles. No se añade esta ruta al menú de producción ni se cambia la navegación de Fable.
- **Añadir al presupuesto** (`src/components/plan/add-to-budget.tsx`, `.opt-row`): dentro de la sección Presupuesto de la ficha, tres puertas para aportar partidas al presupuesto que haya, las veces que haga falta: «Desde un plano», «Con fotos y medidas de la visita» (mientras no haya partidas) y «A mano». No es una elección de inicio; si no hay presupuesto, el primer aporte abre la V1.
- **Presupuestar desde un plano** (`/proyectos/[id]/plano`, `src/components/plan/plan-flow.tsx`, lógica en `src/lib/plano-flujo.ts`): cinco pasos con palabras de obra. 1 Sube el plano (se guarda en Documentos; la lectura automática aún no existe, ver PREGUNTAS). 2 Dale una medida: dos toques sobre el plano, pegados al vértice más cercano, y los metros. 3 Confirma las paredes: qué significa cada color del plano («Se tira», «Nueva», «Nada»), lista de paredes con metros y «No es pared». 4 ¿Qué se hace?: altura, huecos y tres trabajos con cantidad del plano y artículo del catálogo sugerido. 5 Revisa y añade: una partida por trabajo, pendientes visibles, y si ya había una parecida se elige «Sustituir» o «Añadir aparte». «Salir» siempre arriba; el borrador se guarda en el navegador. Cabecera fija (`.flow-head`, `.flow-steps`), plano a la izquierda en escritorio (`.flow-split`), control segmentado `.seg`, tarjetas de trabajo `.work-card`.
- Vocabulario del flujo: subir, medida, pared, se tira, nueva, trabajo, partida. Nunca extracción, calibración, candidato, intención ni geometría; esos nombres quedan en el motor y en el laboratorio.
- **Importar expedientes** (`/configuracion/importar`, `src/lib/importar-expedientes.ts`, guía en `docs/importar-expedientes.md`): tres pasos en una página (elegir carpeta, revisar tabla, importar con progreso y resultado). Entra por los comandos del dominio y respeta lo que ya existe. Tabla de aplicación `.table` / `.table-wrap` nueva, con cabecera en monoespaciada y columnas numéricas a la derecha.
- **Proyectos de ejemplo** (`/configuracion/ejemplos`, `src/lib/proyectos-ejemplo.ts`, octubre 2026): los cinco proyectos del modo demo (los que se ven en preview) creados en el espacio de trabajo real por los comandos del dominio, con su catálogo, la V1 aprobada y la V2 en borrador de Monte Alto, tareas hechas y pendientes, compras y un mensaje. Misma página de tres bloques que Importar expedientes (qué va a entrar, botón, resultado). Lo que ya existe no se toca; Hugo lo pidió para que producción tenga contenido como preview.
- **Puertas del presupuesto en la cabecera** (`src/components/plan/budget-doors.tsx`): junto al chat, siempre a la vista, «A mano», «Desde un plano» y «Desde fotos». Por debajo de 1200 px se pliegan en un solo botón «Presupuestar» que abre el menú con las tres (el `Menu` admite ahora `trigger` para un disparador con texto). El bloque «Añadir al presupuesto» de la sección Presupuesto se mantiene como explicación larga.
- **Desde fotos** sustituye a «Estimar en visita» en la ficha y el menú «···», y está disponible siempre, no solo mientras no hay partidas: se puede volver a añadir fotos cuando haga falta. La pantalla (`/proyectos/nueva?proyecto=`) se titula «Fotos y notas de la obra», la miga y «Volver al proyecto» llevan a la ficha, el selector de fotos no fuerza la cámara (el móvil ofrece cámara o galería), y si no se añaden partidas guarda solo las fotos en Documentos y las notas como mensaje del chat; si hay partidas, las añade al borrador abierto en vez de abrir otro presupuesto. Sin `?proyecto=` sigue siendo «Estimar en la visita» y crea el proyecto.
- Salir de un flujo (plano, visita): siempre un botón-icono **X** arriba a la derecha, igual en móvil y escritorio; en escritorio además la flecha con el nombre del proyecto arriba a la izquierda para volver. Nada de botones con la palabra «Salir».
- **Tus planos** (paso 1 del flujo del plano): lista de planos del expediente (`.plan-card`, borde de color por uso), cada uno con «¿Qué muestra?» (demolición, obra nueva, cotas, áreas, instalaciones, otro; sugerido por el nombre del archivo) y su página. Alta por PDF (queda en Documentos; la lectura llega aparte), por varias lecturas `.json` a la vez, o con planos de ejemplo. En el paso 2 se mide una vez (por defecto en el de cotas) y los planos de la misma hoja la comparten; los de otra hoja piden la suya. En el paso 3, pestañas por plano y en vez de preguntar colores se marcan los que cuentan como pared: lo coloreado del plano de demolición se tira, lo del de obra nueva es nuevo. Cada partida dice de qué plano sale.

### Confirmación de escala en varios planos

La coincidencia de tamaño de papel se presenta como ayuda, sin declarar escala verificada. Cada plano puede reutilizar una medida tras confirmación expresa o tener medida propia. El control identifica los dos planos, tiene etiqueta accesible y objetivo táctil mínimo `--pl-touch`; la lista permite varias líneas en móvil. La revisión de partidas requiere elegir sustituir/añadir y muestra la diferencia económica después de esas elecciones.

### Lectura directa de PDF · 28 octubre 2026

En «Tus planos», la acción «Añadir y leer un plano (PDF)» informa del progreso y guarda el original en Documentos. Los avisos se despliegan bajo cada plano como «Lectura parcial · revisar»; un archivo leído no se presenta como presupuesto validado. Se pueden releer planos adjuntos y las opciones JSON de soporte quedan cerradas inicialmente. Se reutilizan componentes y tokens existentes, con la misma estructura en Workspace y Grafito.

### Usabilidad por tareas · 29 octubre 2026

Primera entrega de simplificación autorizada por Hugo: ficha con Resumen / Presupuesto / Obra / Documentos / Compras; presupuesto con selector de versión y vistas Partidas / Versiones / Comparar cambios. Capítulos, condiciones y opciones avanzadas desplegables evitan mostrarlo todo a la vez. Comparación antes/después por campo y condiciones, con etiquetas además del color. La edición de versiones históricas no se confunde con el borrador actual.

Ajuste de tokens: `--pl-text-xs` 12 px, `--pl-text-sm` 13 px, `--pl-text-md` 14 px; `--pl-button-height-desktop` y `--pl-icon-button` 44 px. Se conservan paleta y temas. Pestañas con flechas/Inicio/Fin; selectores nativos para elegir versiones. CSS propio en `src/styles/project-workspace.css`. Criterios, alcance y próximos módulos en `docs/usabilidad/README.md`.
- **«Desde fotos» en dos pantallas** (pasada de usabilidad): sobre un proyecto, «Fotos y notas» (cámara o galería, qué quiere el cliente, comprobado en la visita, y la cifra orientativa plegada como opcional) y «Guardar». Al crear un proyecto desde la visita se antepone «Datos». Los números de paso internos se conservan; el indicador numera por posición.
- **Flujo del plano en tres pasos** (pasada de usabilidad): Tus planos · Mide y confirma las paredes · Qué se hace y qué entra en el presupuesto. Medir y ver las paredes ocurre en la misma pantalla: al dar la medida, las paredes se dibujan con sus metros; los colores que cuentan como pared quedan plegados. Los trabajos y las partidas resultantes van juntos, con los huecos plegados como opcional y el botón de añadir al pie. Los borradores guardados con cinco pasos se recolocan solos.
- **Chat más sencillo** (pasada de usabilidad): en la cabecera quedan los participantes, la lupa (siempre visible, también desde la pantalla de participantes, fotos y documentos; 29-10, a petición de Hugo) y un menú «···» con fotos y documentos, mencionar algo del proyecto, consultar escribiendo y la ayuda. El subtítulo del cajón lleva la dirección de la obra y el código del proyecto. El compositor es clip, mensaje y enviar; `#` y `/` siguen funcionando al escribirlos para quien los conozca. La pantalla vacía dice una sola cosa: los botones de abajo consultan sin salir.
- **Navegación** (octubre 2026, pasada de usabilidad): en móvil, cinco entradas en la barra inferior (Hoy, Proyectos, Agenda, Clientes y Más; el resto cuelga de «Más», que queda marcada al estar en una de ellas). En tablet y escritorio, el menú completo en el carril o la barra lateral: Hugo prefiere ver todas las secciones cuando hay sitio. Ese menú queda fijo al desplazar la página (`position: sticky` con `top: 0`; ojo con `inset: auto`, que si va después pisa el `top`) y se desplaza por dentro si la ventana es más baja que la lista.
- **La versión actual, inconfundible** (`.current-badge`, `.pulse-dot`): junto al selector de versión, una insignia verde «ACTUAL · V2 en borrador» con un punto que late (sin animación si el sistema pide menos movimiento); al consultar una anterior, insignia ámbar «Versión anterior · la actual es la V2» con «Ir a la actual». En el historial, la tarjeta de la actual lleva el borde y la insignia en verde.
- **Añadir al presupuesto, arriba y abajo**: las tres puertas («A mano», «Desde un plano», «Desde fotos») vuelven a la cabecera junto al chat (plegadas en «Presupuestar» por debajo de 1200 px) y se mantiene el bloque explicativo dentro del presupuesto. Hugo quiere la acción accesible sin bajar. *(Revisado el 29-10: en móvil las tres vías pasan a la hoja «···», que sigue arriba; en el presupuesto, «Añadir trabajos a la Vn» es una fila justo después del último capítulo; ver «Ficha compacta».)*

### Ficha compacta y hoja de acciones · 29 octubre 2026 (segunda pasada)

Sale del lienzo «Usabilidad Plano» (Design artifact) y de sus tres principios: una acción principal por pantalla, contenido antes que marco (en 390 px, menos de 180 px encima del primer dato) y cada estado dicho una vez.

- **Cabecera de la ficha** (`.project-head`, CSS en `src/styles/project-workspace.css`). En móvil es una sola línea de 44 px: flecha de volver (`BackLink compact`), nombre con código y cliente en una línea cada uno (elipsis), chip de fase (`.pill.project-phase`, tocable: abre «Cambiar de fase») y «···». En escritorio conserva «← Proyectos», el título grande, el chip junto al título y las acciones a la derecha (tres puertas, Chat, «···»). Las pestañas de la ficha sangran hasta el borde de la pantalla en móvil y conservan el degradado de desplazamiento.
- **Hoja de acciones** (`ProjectMenu`): en escritorio sigue siendo el menú «···»; por debajo de 768 px el mismo botón abre un `Modal` (hoja inferior) con las acciones agrupadas por lo que hacen, no por dónde caben: «Abrir el chat» primero, «Nuevo presupuesto» (a mano, desde un plano, desde fotos), «Obra» (planificar tarea, nueva certificación con el saldo) y «Proyecto» (cambiar de fase). Filas `.opt-row` con icono, título y una línea de ayuda; las que no aplican van deshabilitadas con el motivo. El botón «Chat» de la cabecera no se muestra en móvil: el nombre del proyecto necesita el sitio.
- **Resumen por fase**: dos tarjetas compactas que llevan a su pestaña (`.overview-card`): «Obra» con avance, medidor y tareas hechas, y «Presupuesto» con el total, las versiones como píldoras (`V1 aprobada`, `V2 borrador`) y la diferencia frente a la aprobada. Antes de la obra (primera visita o presupuestando sin tareas) la tarjeta de avance no aparece: en su lugar, «Para poder presupuestar», una lista de lo que hay y lo que falta (dirección, tipo, fotos del estado actual, presupuesto abierto). En teléfonos estrechos esa lista ocupa el ancho entero.
- **Fila de versiones** (`.version-row`, `.version-pill`): sustituye al selector «Versión que estás viendo», la insignia «ACTUAL», la línea «Para ejecutar la obra» y la cabecera «BORRADOR ACTUAL». Cada versión es un botón `aria-pressed` con una palabra de estado (aprobada ✓ en verde, borrador en ámbar, cerrada en azul, anterior / histórica en gris); el color acompaña al texto. Comparar e historial son dos botones de icono junto al total; el menú «···» de la versión reúne imprimir, nueva revisión y cerrar (con confirmación). Las vistas «Versiones» y «Comparar» dejan de ser pestañas: se abren desde esos botones y vuelven con «← Partidas de Vn».
- **Total arriba**: `.budget-total-head` con V y título como eyebrow, el total con IVA en grande, base e IVA en una línea con la diferencia frente a la aprobada como enlace al comparador, y la fecha de edición.
- **Una acción principal**: `BudgetActions` muestra solo «Editar partidas» (borrador) o «Aprobar Vn para obra» (cerrada) en `.budget-actions-bar`, que en móvil queda fija sobre la barra de navegación (`position: fixed`, `bottom: var(--pl-nav-bar)`); el resto está en el menú de la versión.
- **Capítulos abiertos**: `.budget-chapter` nace abierto, sin caja, con chevron, cabecera de 44 px y partidas en filas densas (`.budget-reading-item`, nombre · medición · importe; alternativas y excluidas en gris). La app recuerda los capítulos que plegaste (`localStorage`, `plano.capitulos-cerrados.<presupuesto>`). «Añadir trabajos a la Vn · catálogo · plano · fotos» es una fila tocable después del último capítulo que abre `AddToBudget` en un `Modal`.

Tokens: ninguno nuevo. Pendiente para otra pasada: Hoy, editor de partidas a pantalla completa, comparador por filas y agenda compacta (tableros del mismo lienzo).
