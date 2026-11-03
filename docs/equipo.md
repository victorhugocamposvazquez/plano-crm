# Puestos y equipo · contrato de servidor

Entrega solicitada por Hugo y Fable el 3/11/2026, sobre main 30fffab. Los permisos siguen siendo `admin`, `office`, `manager`, `site`, `viewer`. El puesto es presentación: no autoriza una acción, no modifica `can()` para acciones existentes y no cambia aprobación, facturación ni certificaciones.

## Datos y compatibilidad

- `Actor.position: Puesto` y `organization_members.position text not null default 'oficina'`. Valores exactos: `direccion`, `oficina`, `tienda`, `facturacion`, `materiales`, `jefe_obra`, `equipo`.
- La migración conserva el inicio anterior de los miembros existentes según su permiso: admin/viewer → dirección, manager → jefe de obra, site → equipo, office → oficina. No infiere puestos por el nombre. Las altas SQL futuras sin puesto reciben `oficina`.
- `Workspace.members: { user_id, display_name, position, role }[]`. Lectura de compañeros de la misma empresa por RLS y proyección explícita; sin correos, metadatos de Auth ni datos de otras empresas. Se mantiene `organization_id` como columna consultable para filtrar la empresa, sin añadirlo a cada objeto del listado.
- `Task.assignee_id: string|null`, `Purchase.assignee_id: string|null` y `assignee: string` en ambos. No se vinculan los nombres antiguos automáticamente. Con UUID se obtiene siempre el nombre del miembro en servidor, ignorando un nombre contradictorio del cliente. Sin UUID se conserva el texto libre antiguo.
- Una actualización sin campos de asignación conserva el responsable. `assignee_id: null` desasigna; admite `assignee` opcional para texto libre. Editar solo `assignee` elimina el vínculo UUID anterior. Una persona retirada pierde el vínculo UUID, conservando su texto histórico en tareas y compras.
- La demo incluye siete personas ficticias, una por puesto, y completa copias antiguas sin borrar su trabajo.
- Se normaliza el identificador anterior de interfaz `jefe-obra` a `jefe_obra`; la lectura local admite el valor antiguo. En sesión real `usePuesto()` toma `actor.position`, y la preferencia antigua no lo sustituye. `cambiarPuesto` queda como vista previa temporal, sin escritura ni autorización; en demo conserva su preferencia local. `esMia` usa UUID si existe y solo recurre al nombre para los datos antiguos.

## Comandos

Se envían a `POST /api/commands`, con sesión, origen de la aplicación y cabecera `Idempotency-Key: <uuid>`.

- `member.update { user_id, position, role }`: solo admin, solo miembro de su empresa. Permite modificar el puesto propio; para rebajar su permiso de admin debe existir otro admin. No elimina al último admin.
- `member.remove { user_id }`: solo admin, nunca la baja propia ni del último admin. Retira pertenencia y asignaciones activas, no borra la cuenta global de Auth ni su historial.
- `member.invite { email, position, role }`: solo admin. Sin envío configurado devuelve 503 con instrucciones de alta manual, sin preparar solicitudes ni enviar correos. En demo no simula un envío.
- `task.create` y `task.update` aceptan `assignee_id?: uuid|null`; en create `assignee` es opcional si se usa UUID. `purchase.update` acepta `assignee_id` y `assignee`; estado y cantidades son opcionales para poder reasignar sin modificar la recepción. Se mantienen sus validaciones previas y permisos, incluido `purchase.update` para site.

La respuesta de comandos incluye `workspace` y `actor` actualizado. El proveedor actualiza identidad y puesto después de guardar. No se acepta un permiso, empresa o nombre de autor enviados por el navegador. Los RPC serializan los comandos de la empresa y comprueban el rol después del bloqueo, evitando emplear un permiso revocado mientras esperaban.

## Activación de invitaciones por correo

No se ha configurado ni probado contra destinatarios reales. Requiere revisión de Hugo:

1. Aplicar la migración y configurar Supabase Auth/SMTP, Site URL y los destinos permitidos para el dominio real.
2. Configurar la plantilla **Invite user** para usar este enlace de confirmación de servidor: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`. La ruta canjea solo invitaciones con `verifyOtp`, guarda la sesión mediante el cliente SSR y vuelve a `/`; ignora destinos, puestos y permisos enviados en la URL. Un enlace inválido/caducado vuelve a login sin propagar el token ni detalles internos.
3. Añadir **solo al servidor** `SUPABASE_SECRET_KEY` (o `SUPABASE_SERVICE_ROLE_KEY` antigua). Nunca usar `NEXT_PUBLIC_` para esa clave. Se utiliza exclusivamente para `Auth.admin.inviteUserByEmail`; las mutaciones de la empresa se hacen con el cliente de la sesión y sus RPC autorizados.
4. Activar `PLANO_MEMBER_INVITES_ENABLED=true` solo tras comprobar SMTP y plantilla. Recibir éxito del proveedor significa envío aceptado, no prueba de entrega al buzón.

`member.invite` registra una solicitud con email visible solo a admin por RLS; ese registro no entra en `Workspace.members`. `claim_member_invitation` reclama el envío una sola vez. `complete_member_invitation` verifica contra Auth el UUID, email y fecha de invitación, vuelve a comprobar admin y crea la pertenencia con el puesto/permiso registrados. No se confía en metadatos editables del usuario. El nombre inicial es `Persona invitada`; Hugo puede sustituirlo por el nombre real en `organization_members.display_name`. Pantalla de edición de nombre y configuración de contraseña/perfil corresponden a una entrega posterior de interfaz.

Si se pierde una respuesta, se reintenta con **la misma clave y el mismo comando**. Un envío completado no se repite. Si Auth creó la invitación pero falló el alta del equipo, se recupera el UUID de la invitación y se vuelve a completar sin reenviar. Si el envío quedó en un estado ambiguo, se devuelve 409/503 y administración revisa Auth y `member_invitations` antes de actuar; no se promete atomicidad entre correo y PostgreSQL. No se borra automáticamente una cuenta de Auth para compensar un fallo.

Las cuentas que ya existían requieren revisión manual. El inicio de sesión actual solo admite un espacio por cuenta: no se reutiliza una cuenta de otra empresa ni se modifica su permiso al invitar. Los registros pendientes pueden consultarlos los administradores; no hay aún pantalla de reenvío/cancelación ni proceso automático de limpieza.

Fuentes primarias para la configuración: [Supabase: invitación administrativa](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail), [plantillas y canje de TokenHash en servidor](https://supabase.com/docs/guides/auth/auth-email-templates). La configuración concreta del proyecto queda pendiente; no se ha enviado correo desde estas pruebas.

## Alta manual si el envío no está configurado

Hugo crea o invita la cuenta desde **Supabase → Authentication → Users**, anota el UUID de Auth y comprueba que no pertenece a otro equipo de esta aplicación. Después aplica en SQL Editor, sustituyendo los valores ficticios:

```sql
insert into public.organization_members
  (organization_id,user_id,display_name,position,role)
values
  ('UUID_EMPRESA','UUID_AUTH','Nombre y apellidos','jefe_obra','manager');
```

No crear roles SQL ni asignar permisos desde `user_metadata`. Usar uno de los cinco roles de la aplicación. La confirmación del correo y el acceso/contraseña de esa cuenta se preparan en Auth; no inventar una contraseña compartida. Volver a iniciar sesión o recargar el espacio para ver el puesto y el equipo.

## Migración y comprobación

`supabase/migrations/202611030001_puestos_equipo.sql` queda **preparada, sin aplicar**. Hugo la aplica a mano en SQL Editor y recarga PostgREST (`notify pgrst, 'reload schema';`). Ese procedimiento no registra la migración en `supabase_migrations.schema_migrations`.

Fable informa de que las migraciones 202611010001 y 202611010002 ya fueron aplicadas manualmente y tampoco constan en ese historial. Antes de cualquier futuro `supabase db push`, comprobar catálogo y usar `migration repair` únicamente para las migraciones realmente aplicadas. No ejecutar otra vez a ciegas los archivos ni marcar esta nueva migración como aplicada antes de verificarla. Esta entrega no aplica SQL ni cambia el historial de producción.

Comprobación local: `npm run check`. Las pruebas de dominio, HTTP y PostgreSQL/PGlite incluyen RLS de compañeros e invitaciones, site con puesto dirección sin autoridad administrativa, responsable de otra empresa rechazado, reglas de último admin/baja propia, asignación por UUID y nombre de servidor, conservación de histórico, reintentos y recuperación del alta tras Auth. No requieren claves reales ni envían correos.

Para probar tras aplicar a mano en un entorno de prueba: consultar `/api/workspace` con dos miembros de una empresa y uno de otra; comprobar el listado de cuatro campos y `actor.position`. Enviar `member.update` como admin, recargar desde otro navegador y comprobar el mismo puesto. Repetir como site: 403. Asignar una tarea o compra a un compañero y comprobar UUID y nombre; usar un UUID de otra empresa: 400. Intentar la baja propia o rebajar al último admin: rechazo. Si invitaciones están desactivadas, el comando debe devolver el aviso de alta manual sin enviar correo.

Queda fuera: pantalla Equipo y selectores de personas, gestión de perfil/contraseña, cambio de nombre por comando, cancelar/reenviar invitaciones desde la interfaz, múltiples espacios por cuenta y registro de notificaciones de asignación. No se rediseñan las pantallas de Fable.
