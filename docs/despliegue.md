# Conectar Supabase, GitHub y Vercel

## Entornos

Usar un proyecto Supabase de desarrollo o preproducción para las primeras pruebas. El proyecto de producción debe mantenerse separado de las previews de Vercel. Esta entrega no ha creado proyectos de pago, desplegado la web ni ejecutado migraciones remotas.

## Supabase

1. Crear o identificar el proyecto de desarrollo de PLANO y su región. Confirmar el proyecto antes de ejecutar comandos que escriban en él.
2. Revisar `supabase/migrations/202610260001_workspace.sql`. Aplicar con la CLI oficial a ese proyecto (`supabase link --project-ref ...`, `supabase db push`) o mediante el editor SQL de Supabase. La migración crea tablas, permisos, funciones y un bucket privado; está pensada para una base nueva.
3. Desactivar el registro público en Auth. Crear la primera cuenta desde el panel de administración. No usar cuentas de clientes finales.
4. Crear la organización y su primera membresía desde el editor SQL, sustituyendo el UUID de ejemplo por el ID del usuario creado:

```sql
with org as (
  insert into public.organizations(name) values ('GARAL') returning id
)
insert into public.organization_members(organization_id,user_id,display_name,role)
select id, 'UUID-DEL-USUARIO'::uuid, 'Nombre de la persona', 'admin' from org;
```

5. Copiar `.env.example` a `.env.local` y añadir URL y clave publicable. No se necesita `service_role` para la aplicación. No introducir esa clave en variables `NEXT_PUBLIC_*`.
6. Configurar URL del sitio y orígenes de retorno en Supabase Auth para los dominios usados. Completar la pantalla `/login` coordinada con Claude.
7. Probar con dos cuentas reales de desarrollo de roles distintos. Verificar acceso, guardar/cerrar/aprobar/revisar presupuestos, un conflicto de edición y una subida/descarga real. Las pruebas embebidas no sustituyen las de Auth y Storage alojados.

## GitHub y Vercel

Repositorio: https://github.com/victorhugocamposvazquez/plano-crm

- Trabajar en ramas `codex/*` y `claude/*`, con PR a `main`. La CI ejecuta `npm run check` sin secretos.
- Conectar el repositorio a Vercel con framework Next.js, Node.js 22 y comandos estándar (`npm ci`, `npm run build`). No hace falta `vercel.json`.
- Definir `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` por entorno. Las previews deben apuntar a Supabase de desarrollo.
- No habilitar usuarios reales mientras falten la pantalla de acceso y la validación de permisos por perfil. Sin variables se abre la demostración local; configurar una sola variable produce error, sin volver silenciosamente al modo local.
- Antes de producción: pruebas alojadas de Auth/Storage/RLS, decisión de perfiles, política de copias/retención, importación verificada y separación de datos internos/clientes.

## Migración única del NAS

La migración es un trabajo de incorporación de datos, no una función permanente de sincronización con el NAS.

1. Inventariar carpetas y archivos sin mover originales. Registrar hash, tamaño, tipo, ruta original y proyecto propuesto; detectar duplicados por contenido.
2. Confirmar con GARAL qué presupuestos pertenecen al mismo ámbito y cuáles son alternativas o subproyectos. Número de archivo y fecha no prueban aprobación.
3. Extraer partidas y condiciones como propuestas. Revisar cantidades, unidades, impuestos, exclusiones y alternativas; no sumar todos los importes de un PDF.
4. Subir originales a almacenamiento privado y registrar sus hashes. Asociar las revisiones importadas a su documento original y marcar su estado de aprobación como pendiente hasta validación humana.
5. Probar una reforma integral, una parcial y una de carpintería. Contrastar totales y número de archivos antes de ampliar la importación.
6. Migrar el resto, entregar un informe de conciliación y conservar una copia de los originales conforme a la retención acordada. No retirar el NAS hasta aceptar la migración.

La importación histórica aún no está implementada. El esquema actual necesita metadatos de procedencia, checksums y un estado específico de revisión importada antes de ejecutar este plan.

## Referencias oficiales consultadas

- [Instalación de Next.js](https://nextjs.org/docs/app/getting-started/installation).
- [Autenticación de Supabase con Next.js](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs).
