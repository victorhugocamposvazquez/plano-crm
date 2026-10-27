# Backend y contrato para la interfaz

Entrega de Codex, 26-10-2026. Conserva `Workspace`, `Command`, `Actor` y la firma de `useWorkspace`. Interfaz, tokens, marcas y buscador de Claude quedan sin cambios.

## Sesión

- `POST /api/auth/sign-in`: JSON `{ email, password }`. Devuelve `{ ok: true, redirect: "/obras" }` y la sesión mediante cookies. Solo admite cuentas ya autorizadas en `organization_members`.
- `POST /api/auth/sign-out`: JSON `{}`. Cierra la sesión de este navegador y devuelve `redirect: "/login"`.
- `src/proxy.ts` refresca cookies. Cada ruta vuelve a verificar usuario y membresía. No se confía en roles o identificadores de organización enviados por el cliente.
- No hay registro público, gestión de invitaciones, recuperación de contraseña ni selector de organización todavía. Una cuenta con varias membresías recibe un error explícito en vez de elegir un espacio arbitrario.

Claude debe crear `/login` fuera del `WorkspaceProvider` y del `AppShell` de las rutas privadas; el proveedor no debe recargar el espacio en la página de acceso. Se recomienda separar layouts con grupos de rutas. El backend no incluye esa pantalla para respetar el reparto.

## Lectura y escritura

- `GET /api/workspace` devuelve `{ workspace, actor }`. Sin caché compartida. La actividad muestra los 200 eventos más recientes; el historial completo permanece en la base de datos.
- `POST /api/commands` recibe un `Command` validado con Zod y devuelve `{ workspace }` actualizado. Se mantiene `send(command)` en el proveedor.
- Los POST JSON exigen `Origin` del mismo host. Respuestas: 400 validación, 401 sesión, 403 permisos, 404 no encontrado, 409 conflicto, 413 tamaño, 503 servicio/configuración. Formato de error: `{ error: string }` y opcionalmente `fields`.
- `Idempotency-Key` admite un UUID. Repetir la misma clave y comando no duplica la operación; cambiar el comando manteniendo la clave se rechaza. El proveedor conserva la clave para reintentar una operación fallida dentro de la sesión del componente. Después de recargar la página hay que consultar el estado antes de repetir una acción de creación.
- El RPC `execute_command` valida membresía, rol y pertenencia de cada registro, bloquea la organización durante la transacción, modifica datos y escribe auditoría. Las tablas no admiten escritura directa desde las claves públicas, ni siquiera para perfiles de administración.

## Presupuestos

Un presupuesto tiene varias revisiones y como máximo un borrador. El puntero `approved_version_id` se mantiene al crear o editar el borrador. Solo cambia al aprobar explícitamente una revisión cerrada.

Flujo: `budget.create` → `budget.save` → `budget.issue` → `budget.approve`. El comando `budget.revise` copia una revisión cerrada manteniendo los IDs de sus partidas, para que el comparador pueda relacionarlas. No modifica la anterior. Cerrar una revisión no envía correos ni mensajes al cliente.

Cada guardado exige `expected_revision`. Si otra persona ya guardó, el servidor devuelve 409. La pantalla debe conservar la edición local, ofrecer recargar/comparar y pedir una nueva decisión; no repetir el guardado con el nuevo número de forma automática.

La aprobación exige `reference`, por ejemplo el documento o mensaje donde se aceptó. La referencia no es una firma electrónica. Los contenidos y las referencias de las revisiones aprobadas quedan protegidos también mediante un trigger.

Importes en céntimos enteros. Cantidades con hasta tres decimales y porcentajes con hasta dos. Se redondea cada partida al céntimo y después su IVA. Solo las partidas `included` entran en el total; `optional` y `excluded` conservan su importe informativo. El ajuste se aplica siempre sobre el precio unitario base. El catálogo no modifica los precios copiados a una revisión.

`compareVersions` devuelve cambios de partidas, incluidos descripción, unidad, cantidad, precio, ajuste, IVA e inclusión. La interfaz debe mostrar además las notas y condiciones de ambas versiones; no basta con el delta económico. Distinguir siempre base, IVA y total al comparar.

## Archivos

`POST /api/uploads` recibe `{ project_id, name, category, mime_type, size_bytes }` y devuelve `{ path, token }`. El navegador sube el binario directamente a Supabase Storage con `uploadToSignedUrl` y después registra `document.add`. Así los vídeos no atraviesan el cuerpo de una función Vercel.

Bucket privado `project-files`, límite de 50 MiB por archivo. Admite PDF, JPG, PNG, WebP y MP4. Rutas `organización/proyecto/uuid`. Se comprueba el objeto subido y sus metadatos antes de registrar el documento. No hay sobrescritura ni borrado desde el cliente. Los DWG, vídeos mayores, cargas reanudables y la limpieza de subidas incompletas necesitan una ampliación del flujo.

`GET /api/documents/[id]` genera una descarga firmada de 60 segundos, después de comprobar acceso. Las galerías y el visor de planos necesitarán una ruta de vista previa específica; la descarga actual se sirve como adjunto. La landing pública del cliente tendrá permisos y selecciones independientes; no reutilizar estas URL como enlaces permanentes.

## Permisos provisionales

Todos los miembros pueden leer su organización; no pueden leer otras. `viewer` no escribe. `site` solo actualiza tareas y recepciones, envía mensajes y adjunta documentos. `manager` gestiona proyectos y presupuestos pero no aprueba ni prepara certificaciones. `admin` y `office` pueden aprobar y preparar certificaciones.

Esta primera política concede acceso por organización, no asignación individual por proyecto. Antes de incorporar usuarios reales hay que confirmar con Hugo el acceso a precios, datos económicos y documentos por perfil y por proyecto. No crear cuentas de clientes dentro de esta política interna.

## Pendientes del producto completo

Se conservan como alcance: clientes y oportunidades, visita y estimación asistida, catálogo, planos y mediciones, presupuestos/versiones, documentos/checklists/chat, compras/albaranes/recepciones, agenda/equipo/tiempos, seguimiento e incidencias, certificaciones/facturación/cobros, remates/entrega/cierre económico y galería compartible. La migración inicial implementa una base para varios de estos módulos; no equivale al CRM completo terminado.

## Mensajes: edición y borrado (migración 202610270001)

`messages` guarda `author_id` (quién lo escribió), `edited_at` y `deleted_at`. `message.edit` solo lo ejecuta el autor y marca `edited_at`; `message.delete` lo ejecuta el autor, oficina o administración y deja el mensaje con cuerpo vacío y `deleted_at` (borrado lógico: la conversación conserva el hueco). La interfaz lee los dos campos del `select *` habitual.

## Reacciones (migración 202610270002)

`messages.reactions` es un `jsonb` `{emoji: [nombres mostrados]}`. `message.react` alterna la reacción de quien la ejecuta: la añade si no estaba y la quita si estaba, borrando la clave cuando se queda vacía. Solo admite 👍 ✅ ❤️ 👀 🙏 ⚠️. Equipo de obra puede reaccionar; consulta no.

## Tareas: edición y borrado (migración 202610270003)

`task.update` recibe `id` y cualquier subconjunto de `title`, `trade`, `assignee`, `due_date`, `weight`; valida igual que `task.create` y solo cambia lo enviado. `task.delete` borra la tarea (el avance del proyecto se recalcula al vuelo). Ambos vedados al equipo de obra.
