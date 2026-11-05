-- Parte vivo: el enlace que recibe un operario por WhatsApp lleva un token secreto y, sin cuenta ni registro,
-- deja ver la tarea al día, marcarla como hecha, escribir al chat del proyecto y subir fotos.
-- Lo que puede hacer quien tenga el enlace se limita a las funciones parte_* de abajo (anon), siempre con el token.
-- Requiere 202611050002_operarios.sql aplicada antes: execute_command se redefine entera a partir de esa versión.
create table public.task_shares (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  operario_id uuid null references public.operarios(id) on delete set null,
  token text not null unique check(token ~ '^[0-9a-f]{64}$'),
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id), created_by_name text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  revoked_at timestamptz null, done_at timestamptz null, seen_at timestamptz null,
  messages_count integer not null default 0, photos_count integer not null default 0
);
create index task_shares_task on public.task_shares(organization_id,task_id);
alter table public.task_shares enable row level security;
revoke all on public.task_shares from public,anon,authenticated;
grant select on public.task_shares to authenticated;
create policy member_read on public.task_shares for select to authenticated using (private.member_role(organization_id) is not null);

-- Permisos de subida de una foto: uno por foto, 15 minutos, para una ruta concreta.
create table private.parte_subidas (
  path text primary key, share_id uuid not null references public.task_shares(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '15 minutes', used boolean not null default false
);
revoke all on private.parte_subidas from public,anon,authenticated;

create function private.parte_valido(p_token text) returns public.task_shares
language sql stable security definer set search_path = '' as $$
  select s.* from public.task_shares s where p_token ~ '^[0-9a-f]{64}$' and s.token=p_token and s.revoked_at is null and s.expires_at>now()
$$;
revoke all on function private.parte_valido(text) from public;

/** Lo que ve el operario: la tarea al día (título, fecha, estado) y lo que se le escribió al enviarla. Sin datos del cliente ni precios. */
create function public.parte_ver(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.task_shares; t public.tasks; p public.projects; org text;
begin
  s := private.parte_valido(p_token);
  if s.id is null then return jsonb_build_object('estado','no_valido'); end if;
  select * into t from public.tasks where id=s.task_id; select * into p from public.projects where id=t.project_id; select name into org from public.organizations where id=s.organization_id;
  update public.task_shares set seen_at=now() where id=s.id;
  return jsonb_build_object('estado','ok','empresa',org,'obra',p.name,'direccion',coalesce(nullif(s.snapshot->>'direccion',''),p.location),
    'tarea',t.title,'oficio',t.trade,'fecha',t.due_date,'hecha',t.status='done','hecha_el',s.done_at,
    'para',coalesce(nullif(s.snapshot->>'para',''),t.assignee),'contacto',s.snapshot->>'contacto','telefono',s.snapshot->>'telefono',
    'notas',s.snapshot->>'notas','material',coalesce(s.snapshot->'material','[]'::jsonb),'fotos',s.photos_count,'mensajes',s.messages_count,'caduca',s.expires_at);
end $$;

create function private.parte_mensaje_chat(s public.task_shares, p_texto text) returns void
language plpgsql security definer set search_path = '' as $$
declare t public.tasks; quien text;
begin
  select * into t from public.tasks where id=s.task_id;
  quien := coalesce(nullif(s.snapshot->>'para',''),nullif(t.assignee,''),'Operario')||' · parte';
  insert into public.messages(organization_id,project_id,body,author_name) values(s.organization_id,t.project_id,left(p_texto,5000),left(quien,120));
end $$;
revoke all on function private.parte_mensaje_chat(public.task_shares,text) from public;

/** El operario da la tarea por hecha, con una nota opcional que llega al chat del proyecto. */
create function public.parte_hecho(p_token text, p_nota text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.task_shares; t public.tasks; nota text := left(btrim(coalesce(p_nota,'')),1000);
begin
  s := private.parte_valido(p_token);
  if s.id is null then raise exception 'Este enlace ya no es válido.' using errcode='22023'; end if;
  select * into t from public.tasks where id=s.task_id for update;
  if t.status<>'done' then
    update public.tasks set status='done' where id=t.id;
    update public.task_shares set done_at=now() where id=s.id;
    perform private.parte_mensaje_chat(s,'Hecho: '||t.title||case when nota<>'' then E'\n'||nota else '' end);
    insert into public.activities(organization_id,project_id,text,actor_name,actor_id,command_type)
    values(s.organization_id,t.project_id,'Completada desde el parte: '||t.title,left(coalesce(nullif(s.snapshot->>'para',''),'Operario'),120),s.created_by,'parte.done');
  end if;
  return public.parte_ver(p_token);
end $$;

/** El operario escribe al equipo (una duda, un imprevisto): llega al chat del proyecto. Hasta 30 mensajes por parte. */
create function public.parte_mensaje(p_token text, p_texto text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.task_shares; texto text := left(btrim(coalesce(p_texto,'')),1000);
begin
  s := private.parte_valido(p_token);
  if s.id is null then raise exception 'Este enlace ya no es válido.' using errcode='22023'; end if;
  if texto='' then raise exception 'Escribe el mensaje.' using errcode='22023'; end if;
  if s.messages_count>=30 then raise exception 'Has enviado muchos mensajes desde este enlace. Llama a tu contacto.' using errcode='22023'; end if;
  perform private.parte_mensaje_chat(s,texto);
  update public.task_shares set messages_count=messages_count+1 where id=s.id;
  return public.parte_ver(p_token);
end $$;

/** Reserva la ruta de una foto (JPG, PNG o WebP) para subirla al almacenamiento del proyecto. Hasta 20 fotos por parte. */
create function public.parte_reservar_foto(p_token text) returns text
language plpgsql security definer set search_path = '' as $$
declare s public.task_shares; t public.tasks; ruta text;
begin
  s := private.parte_valido(p_token);
  if s.id is null then raise exception 'Este enlace ya no es válido.' using errcode='22023'; end if;
  if s.photos_count+(select count(*) from private.parte_subidas where share_id=s.id and not used and expires_at>now())>=20 then raise exception 'Ya se han subido 20 fotos desde este enlace.' using errcode='22023'; end if;
  select * into t from public.tasks where id=s.task_id;
  ruta := s.organization_id::text||'/'||t.project_id::text||'/'||gen_random_uuid()::text;
  insert into private.parte_subidas(path,share_id) values(ruta,s.id);
  return ruta;
end $$;

-- En public (no en private) para que la política de Storage la pueda llamar quien no tiene sesión. Solo dice si una ruta reservada sigue libre.
create function public.parte_subida_ok(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.parte_subidas u where u.path=p_path and not u.used and u.expires_at>now())
$$;
revoke all on function public.parte_subida_ok(text) from public;
grant execute on function public.parte_subida_ok(text) to anon, authenticated;
create policy parte_file_insert on storage.objects for insert to anon
  with check(bucket_id='project-files' and public.parte_subida_ok(name));

/** Registra la foto ya subida como documento «Durante la obra» del proyecto y lo avisa en el chat. */
create function public.parte_foto(p_token text, p_path text, p_nombre text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.task_shares; t public.tasks; u private.parte_subidas; meta jsonb; nombre text;
begin
  s := private.parte_valido(p_token);
  if s.id is null then raise exception 'Este enlace ya no es válido.' using errcode='22023'; end if;
  select * into u from private.parte_subidas where path=p_path and share_id=s.id for update;
  if not found or u.used then raise exception 'Esa foto no corresponde a este parte.' using errcode='22023'; end if;
  select o.metadata into meta from storage.objects o where o.bucket_id='project-files' and o.name=p_path;
  if meta is null then raise exception 'La foto no ha llegado. Vuelve a intentarlo.' using errcode='22023'; end if;
  if coalesce(meta->>'mimetype','') not in ('image/jpeg','image/png','image/webp') or coalesce((meta->>'size')::bigint,0) not between 1 and 15728640 then raise exception 'Solo fotos JPG, PNG o WebP de hasta 15 MB.' using errcode='22023'; end if;
  select * into t from public.tasks where id=s.task_id;
  nombre := left(coalesce(nullif(btrim(p_nombre),''),'Foto')||' · '||t.title,500);
  insert into public.documents(organization_id,project_id,name,category,storage_path,mime_type,size_bytes)
  values(s.organization_id,t.project_id,nombre,'during',p_path,meta->>'mimetype',(meta->>'size')::bigint);
  update private.parte_subidas set used=true where path=p_path;
  update public.task_shares set photos_count=photos_count+1 where id=s.id;
  perform private.parte_mensaje_chat(s,'Ha subido una foto de «'||t.title||'». Está en Planos y fotos.');
  return public.parte_ver(p_token);
end $$;

revoke all on function public.parte_ver(text), public.parte_hecho(text,text), public.parte_mensaje(text,text), public.parte_reservar_foto(text), public.parte_foto(text,text,text) from public;
grant execute on function public.parte_ver(text), public.parte_hecho(text,text), public.parte_mensaje(text,text), public.parte_reservar_foto(text), public.parte_foto(text,text,text) to anon, authenticated;

create or replace function public.execute_command(p_organization_id uuid, p_command jsonb, p_request_id uuid default gen_random_uuid()) returns void
language plpgsql security definer set search_path = '' as $$
declare
  target public.organization_members; assigned_id uuid; assigned_name text; has_assignment boolean;
  member public.organization_members; v public.budget_versions; b public.budgets; p public.purchases; m public.messages;
  action text := p_command->>'type'; project uuid; new_id uuid; sequence_number integer; item jsonb;
  activity text; base bigint; reserved bigint; metadata jsonb; previous_command jsonb;
  inv public.invoices; cert public.certifications; vat numeric; client text; hoy date := (now() at time zone 'Europe/Madrid')::date; due date; year_number integer; importe bigint;
  art public.articles; qty numeric; delta numeric; after_qty numeric; new_received numeric; new_delivered numeric;
  op public.operarios; assigned_operario uuid; op_trades text[]; tsk public.tasks; share_snapshot jsonb;
begin
  -- Comprobar el permiso después del bloqueo impide usar un rol revocado mientras esperaba.
  perform id from public.organizations where id=p_organization_id for update;
  select * into member from public.organization_members where organization_id=p_organization_id and user_id=auth.uid();
  if not found or auth.uid() is null or member.role='viewer' then raise exception 'No tienes permiso para esta acción.' using errcode='42501'; end if;
  if member.role='site' and action not in ('task.toggle','message.send','message.edit','message.delete','message.react','document.add','purchase.update') then raise exception 'No tienes permiso para esta acción.' using errcode='42501'; end if;
  if action in ('budget.approve','certification.create') and member.role not in ('admin','office') then raise exception 'Esta acción corresponde a administración.' using errcode='42501'; end if;
  if action like 'invoice.%' and member.role not in ('admin','office') then raise exception 'Esta acción corresponde a administración.' using errcode='42501'; end if;
  if action like 'member.%' and member.role<>'admin' then raise exception 'Esta acción corresponde a administración.' using errcode='42501'; end if;
  select command into previous_command from public.command_receipts where organization_id=p_organization_id and user_id=auth.uid() and request_id=p_request_id;
  if found then
    if previous_command is distinct from p_command then raise exception 'La clave de solicitud ya corresponde a otra operación.' using errcode='22023'; end if;
    return;
  end if;
  if p_command ? 'project_id' then
    project := (p_command->>'project_id')::uuid;
    if not exists(select 1 from public.projects where id=project and organization_id=p_organization_id) then raise exception 'Proyecto no encontrado.' using errcode='P0002'; end if;
  end if;
  if action in ('budget.revise','budget.save','budget.issue','budget.approve','certification.create') then
    select * into v from public.budget_versions where id=coalesce(p_command->>'version_id',p_command->>'budget_version_id')::uuid and organization_id=p_organization_id for update;
    if not found then raise exception 'Revisión no encontrada.' using errcode='P0002'; end if;
    select * into b from public.budgets where id=v.budget_id and organization_id=p_organization_id;
    if project is not null and project<>b.project_id then raise exception 'El presupuesto pertenece a otro proyecto.' using errcode='22023'; end if;
    project := b.project_id;
  end if;
  has_assignment := p_command ? 'assignee_id' or p_command ? 'assignee' or (action in ('task.create','task.update') and p_command ? 'operario_id');
  if action in ('task.create','task.update','purchase.update') and has_assignment then
    assigned_id := (p_command->>'assignee_id')::uuid;
    assigned_name := left(coalesce(p_command->>'assignee',''),120);
    -- Un operario de la ficha manda: su nombre va a la tarea y, si tiene cuenta en la empresa, también su usuario.
    if action in ('task.create','task.update') and p_command->>'operario_id' is not null then
      select * into op from public.operarios where id=(p_command->>'operario_id')::uuid and organization_id=p_organization_id;
      if not found then raise exception 'Ese operario no está en el equipo.' using errcode='23503'; end if;
      assigned_operario := op.id; assigned_name := op.name;
      assigned_id := case when op.user_id is not null and exists(select 1 from public.organization_members where organization_id=p_organization_id and user_id=op.user_id) then op.user_id else null end;
    elsif assigned_id is not null then
      select display_name into assigned_name from public.organization_members where organization_id=p_organization_id and user_id=assigned_id;
      if not found then raise exception 'La persona no pertenece a esta empresa.' using errcode='23503'; end if;
    end if;
  end if;
  if action in ('operario.create','operario.update') then
    if p_command ? 'name' and length(btrim(coalesce(p_command->>'name',''))) not between 1 and 120 then raise exception 'Escribe el nombre del operario.' using errcode='22023'; end if;
    if p_command ? 'phone' and (length(coalesce(p_command->>'phone',''))>40 or coalesce(p_command->>'phone','') !~ '^[0-9+()[:space:].-]*$') then raise exception 'El teléfono solo admite números, espacios, «+» y guiones.' using errcode='22023'; end if;
    if p_command ? 'email' and coalesce(p_command->>'email','')<>'' and (length(p_command->>'email')>200 or p_command->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') then raise exception 'El correo no es válido.' using errcode='22023'; end if;
    if p_command ? 'company' and length(coalesce(p_command->>'company',''))>120 then raise exception 'Campo no válido: company' using errcode='22023'; end if;
    if p_command ? 'notes' and length(coalesce(p_command->>'notes',''))>500 then raise exception 'Campo no válido: notes' using errcode='22023'; end if;
    if p_command ? 'hourly_cost' and p_command->'hourly_cost' <> 'null'::jsonb and ((p_command->>'hourly_cost')::integer<0 or (p_command->>'hourly_cost')::integer>100000) then raise exception 'Campo no válido: hourly_cost' using errcode='22023'; end if;
    if p_command ? 'trades' then
      if jsonb_typeof(p_command->'trades')<>'array' or jsonb_array_length(p_command->'trades')>20 then raise exception 'Campo no válido: trades' using errcode='22023'; end if;
      select coalesce(array_agg(left(btrim(t),120)),'{}') into op_trades from jsonb_array_elements_text(p_command->'trades') as t where btrim(t)<>'';
    end if;
    if p_command->>'user_id' is not null and not exists(select 1 from public.organization_members where organization_id=p_organization_id and user_id=(p_command->>'user_id')::uuid) then raise exception 'Esa cuenta no pertenece a esta empresa.' using errcode='23503'; end if;
  end if;
  case action
  when 'member.invite' then
    if p_command->>'position' is null or p_command->>'position' not in ('direccion','oficina','tienda','facturacion','materiales','jefe_obra','equipo')
      or p_command->>'role' is null or p_command->>'role' not in ('admin','office','manager','site','viewer')
      or length(coalesce(p_command->>'email','')) not between 3 and 254
      or p_command->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Datos de equipo no válidos.' using errcode='22023'; end if;
    insert into public.member_invitations(organization_id,requested_by,request_id,email,position,role)
      values(p_organization_id,auth.uid(),p_request_id,lower(btrim(p_command->>'email')),p_command->>'position',p_command->>'role');
    activity := 'Solicitud de invitación preparada';
  when 'member.update' then
    if p_command->>'position' is null or p_command->>'position' not in ('direccion','oficina','tienda','facturacion','materiales','jefe_obra','equipo')
      or p_command->>'role' is null or p_command->>'role' not in ('admin','office','manager','site','viewer') then raise exception 'Datos de equipo no válidos.' using errcode='22023'; end if;
    select * into target from public.organization_members where organization_id=p_organization_id and user_id=(p_command->>'user_id')::uuid for update;
    if not found then raise exception 'Persona no encontrada.' using errcode='P0002'; end if;
    if target.role='admin' and p_command->>'role'<>'admin' and (select count(*) from public.organization_members where organization_id=p_organization_id and role='admin')<=1 then raise exception 'La empresa debe conservar al menos una persona administradora.' using errcode='22023'; end if;
    update public.organization_members set position=p_command->>'position',role=p_command->>'role' where organization_id=p_organization_id and user_id=target.user_id;
    activity := 'Puesto y permiso actualizados: '||target.display_name;
  when 'member.remove' then
    select * into target from public.organization_members where organization_id=p_organization_id and user_id=(p_command->>'user_id')::uuid for update;
    if not found then raise exception 'Persona no encontrada.' using errcode='P0002'; end if;
    if target.user_id=auth.uid() then raise exception 'No puedes quitarte a ti mismo del equipo.' using errcode='22023'; end if;
    if target.role='admin' and (select count(*) from public.organization_members where organization_id=p_organization_id and role='admin')<=1 then raise exception 'La empresa debe conservar al menos una persona administradora.' using errcode='22023'; end if;
    update public.tasks set assignee_id=null where organization_id=p_organization_id and assignee_id=target.user_id;
    update public.purchases set assignee_id=null where organization_id=p_organization_id and assignee_id=target.user_id;
    update public.operarios set user_id=null where organization_id=p_organization_id and user_id=target.user_id;
    delete from public.organization_members where organization_id=p_organization_id and user_id=target.user_id;
    activity := 'Persona retirada del equipo: '||target.display_name;
  when 'project.create' then
    update public.organizations set project_counter=project_counter+1 where id=p_organization_id returning project_counter into sequence_number;
    insert into public.projects(organization_id,code,name,client_name,location,kind)
    values(p_organization_id,'PL-'||lpad(sequence_number::text,greatest(3,length(sequence_number::text)),'0'),private.required_text(p_command,'name'),private.required_text(p_command,'client_name'),coalesce(p_command->>'location',''),p_command->>'kind') returning id into project;
    activity := 'Proyecto creado: '||(p_command->>'name');
  when 'project.status' then
    update public.projects set status=p_command->>'status' where id=(p_command->>'id')::uuid and organization_id=p_organization_id returning id into project;
    if not found then raise exception 'Proyecto no encontrado.' using errcode='P0002'; end if;
    activity := 'Estado del proyecto actualizado';
  when 'budget.create' then
    insert into public.budgets(organization_id,project_id,title) values(p_organization_id,project,private.required_text(p_command,'title')) returning id into new_id;
    insert into public.budget_versions(organization_id,budget_id,number,change_reason,created_by_name) values(p_organization_id,new_id,1,'Presupuesto inicial',member.display_name);
    activity := 'Presupuesto creado: '||(p_command->>'title');
  when 'budget.revise' then
    if exists(select 1 from public.budget_versions where budget_id=b.id and status='draft') then raise exception 'Ya hay un borrador abierto. Continúa esa revisión.' using errcode='23505'; end if;
    select max(number)+1 into sequence_number from public.budget_versions where budget_id=b.id;
    insert into public.budget_versions(organization_id,budget_id,number,items,notes,change_reason,created_by_name)
    values(p_organization_id,b.id,sequence_number,v.items,v.notes,private.required_text(p_command,'reason'),member.display_name);
    activity := 'V'||sequence_number||' creada desde V'||v.number||': '||(p_command->>'reason');
  when 'budget.save' then
    if v.status<>'draft' then raise exception 'Esta revisión está cerrada. Crea una nueva versión.' using errcode='22023'; end if;
    if (p_command->>'expected_revision')::integer is distinct from v.draft_revision then raise exception 'Otra persona ha actualizado el borrador. Recarga antes de guardar.' using errcode='40001'; end if;
    if p_command->'items' is null or not private.valid_items(p_command->'items') or jsonb_typeof(p_command->'notes') is distinct from 'string' then raise exception 'Partidas o notas no válidas.' using errcode='22023'; end if;
    update public.budget_versions set items=p_command->'items',notes=p_command->>'notes',draft_revision=draft_revision+1,updated_at=now() where id=v.id;
    activity := 'Borrador V'||v.number||' guardado';
  when 'budget.issue' then
    if v.status<>'draft' or (p_command->>'expected_revision')::integer is distinct from v.draft_revision then raise exception 'La revisión ha cambiado. Recarga antes de cerrarla.' using errcode='40001'; end if;
    if not exists(select 1 from jsonb_array_elements(v.items) i where i->>'inclusion'='included' and (i->>'quantity')::numeric>0) then raise exception 'Añade al menos una partida incluida con cantidad positiva.' using errcode='22023'; end if;
    update public.budget_versions set status='issued',updated_at=now() where id=v.id;
    activity := 'V'||v.number||' cerrada para revisión';
  when 'budget.approve' then
    if v.status<>'issued' then raise exception 'Primero cierra la revisión antes de aprobarla.' using errcode='22023'; end if;
    select coalesce(sum(c.amount),0) into reserved from public.certifications c join public.budget_versions bv on bv.id=c.budget_version_id where bv.budget_id=b.id;
    if private.budget_base(v.items)<reserved then raise exception 'La revisión es inferior al importe ya reservado en certificaciones.' using errcode='22023'; end if;
    update public.budget_versions set status='superseded' where id=b.approved_version_id;
    update public.budget_versions set status='approved',approved_at=now(),approval_reference=private.required_text(p_command,'reference'),updated_at=now() where id=v.id;
    update public.budgets set approved_version_id=v.id where id=b.id;
    activity := 'V'||v.number||' aprobada para obra · '||(p_command->>'reference');
  when 'article.create' then
    if p_command ? 'stock_min' and p_command->>'stock_min' is not null and ((p_command->>'stock_min')::numeric < 0 or (p_command->>'stock_min')::numeric > 1000000) then raise exception 'Campo no válido: stock_min' using errcode='22023'; end if;
    insert into public.articles(organization_id,code,name,chapter,unit,unit_price,vat_rate,stocked,stock_min,stock_location)
    values(p_organization_id,private.required_text(p_command,'code'),private.required_text(p_command,'name'),private.required_text(p_command,'chapter',120),p_command->>'unit',(p_command->>'unit_price')::bigint,(p_command->>'vat_rate')::numeric,
      coalesce((p_command->>'stocked')::boolean,false),(p_command->>'stock_min')::numeric,left(btrim(coalesce(p_command->>'stock_location','')),120));
    activity := 'Artículo creado: '||(p_command->>'name');
  when 'article.update' then
    if p_command ? 'code' and exists(select 1 from public.articles where organization_id=p_organization_id and lower(code)=lower(p_command->>'code') and id<>(p_command->>'id')::uuid) then raise exception 'Ya existe un artículo con esa referencia.' using errcode='23505'; end if;
    if p_command ? 'unit' and p_command->>'unit' not in ('m²','ml','ud','h','global') then raise exception 'Campo no válido: unit' using errcode='22023'; end if;
    if p_command ? 'unit_price' and ((p_command->>'unit_price')::bigint < 0 or (p_command->>'unit_price')::bigint > 100000000) then raise exception 'Campo no válido: unit_price' using errcode='22023'; end if;
    if p_command ? 'vat_rate' and ((p_command->>'vat_rate')::numeric < 0 or (p_command->>'vat_rate')::numeric > 30) then raise exception 'Campo no válido: vat_rate' using errcode='22023'; end if;
    if p_command ? 'stock_min' and p_command->>'stock_min' is not null and ((p_command->>'stock_min')::numeric < 0 or (p_command->>'stock_min')::numeric > 1000000) then raise exception 'Campo no válido: stock_min' using errcode='22023'; end if;
    update public.articles set
      code=case when p_command ? 'code' then private.required_text(p_command,'code') else code end,
      name=case when p_command ? 'name' then private.required_text(p_command,'name') else name end,
      chapter=case when p_command ? 'chapter' then private.required_text(p_command,'chapter',120) else chapter end,
      unit=case when p_command ? 'unit' then p_command->>'unit' else unit end,
      unit_price=case when p_command ? 'unit_price' then (p_command->>'unit_price')::bigint else unit_price end,
      vat_rate=case when p_command ? 'vat_rate' then (p_command->>'vat_rate')::numeric else vat_rate end,
      stocked=case when p_command ? 'stocked' then (p_command->>'stocked')::boolean else stocked end,
      stock_min=case when p_command ? 'stock_min' then (p_command->>'stock_min')::numeric else stock_min end,
      stock_location=case when p_command ? 'stock_location' then left(btrim(coalesce(p_command->>'stock_location','')),120) else stock_location end
    where id=(p_command->>'id')::uuid and organization_id=p_organization_id returning name into activity;
    if not found then raise exception 'Artículo no encontrado.' using errcode='P0002'; end if;
    activity := 'Artículo actualizado: '||activity;
  when 'article.delete' then
    delete from public.articles where id=(p_command->>'id')::uuid and organization_id=p_organization_id returning name into activity;
    if not found then raise exception 'Artículo no encontrado.' using errcode='P0002'; end if;
    activity := 'Artículo eliminado: '||activity;
  when 'stock.move' then
    select * into art from public.articles where id=(p_command->>'article_id')::uuid and organization_id=p_organization_id for update;
    if not found then raise exception 'Artículo no encontrado.' using errcode='P0002'; end if;
    if not art.stocked then raise exception 'Este artículo no se guarda en almacén.' using errcode='22023'; end if;
    qty := (p_command->>'quantity')::numeric;
    if qty is null or qty<0 or qty>1000000 then raise exception 'Indica una cantidad válida.' using errcode='22023'; end if;
    if p_command->>'kind'='recuento' then delta := qty-art.stock_qty;
    elsif p_command->>'kind' in ('entrada','salida') then
      if qty<=0 then raise exception 'Indica una cantidad mayor que cero.' using errcode='22023'; end if;
      if p_command->>'kind'='salida' and qty>art.stock_qty then raise exception 'Solo hay % en almacén.', art.stock_qty using errcode='22023'; end if;
      delta := case when p_command->>'kind'='entrada' then qty else -qty end;
    else raise exception 'Movimiento de almacén no válido.' using errcode='22023';
    end if;
    update public.articles set stock_qty=stock_qty+delta where id=art.id returning stock_qty into after_qty;
    insert into public.stock_movements(organization_id,article_id,project_id,kind,quantity,stock_after,note,actor_name,actor_id)
      values(p_organization_id,art.id,project,p_command->>'kind',delta,after_qty,left(btrim(coalesce(p_command->>'note','')),300),member.display_name,auth.uid());
    activity := 'Almacén · '||art.name||': '||case when p_command->>'kind'='recuento' then 'recuento, '||after_qty||' '||art.unit else (p_command->>'kind')||' de '||qty||' '||art.unit end;
  when 'operario.create' then
    insert into public.operarios(organization_id,name,phone,email,company,trades,hourly_cost,available,user_id,notes)
    values(p_organization_id,btrim(p_command->>'name'),btrim(coalesce(p_command->>'phone','')),lower(btrim(coalesce(p_command->>'email',''))),btrim(coalesce(p_command->>'company','')),coalesce(op_trades,'{}'),
      case when p_command->'hourly_cost' is null or p_command->'hourly_cost'='null'::jsonb then null else (p_command->>'hourly_cost')::integer end,
      coalesce((p_command->>'available')::boolean,true),(p_command->>'user_id')::uuid,btrim(coalesce(p_command->>'notes','')))
    returning name into activity;
    activity := 'Operario añadido: '||activity;
  when 'operario.update' then
    update public.operarios set
      name=case when p_command ? 'name' then btrim(p_command->>'name') else name end,
      phone=case when p_command ? 'phone' then btrim(coalesce(p_command->>'phone','')) else phone end,
      email=case when p_command ? 'email' then lower(btrim(coalesce(p_command->>'email',''))) else email end,
      company=case when p_command ? 'company' then btrim(coalesce(p_command->>'company','')) else company end,
      trades=case when p_command ? 'trades' then coalesce(op_trades,'{}') else trades end,
      hourly_cost=case when p_command ? 'hourly_cost' then case when p_command->'hourly_cost'='null'::jsonb then null else (p_command->>'hourly_cost')::integer end else hourly_cost end,
      available=case when p_command ? 'available' then (p_command->>'available')::boolean else available end,
      user_id=case when p_command ? 'user_id' then (p_command->>'user_id')::uuid else user_id end,
      notes=case when p_command ? 'notes' then btrim(coalesce(p_command->>'notes','')) else notes end
    where id=(p_command->>'id')::uuid and organization_id=p_organization_id returning * into op;
    if not found then raise exception 'Operario no encontrado.' using errcode='P0002'; end if;
    -- Las tareas que tiene asignadas siguen con su nombre al día.
    update public.tasks set assignee=op.name where organization_id=p_organization_id and operario_id=op.id;
    activity := 'Operario actualizado: '||op.name;
  when 'operario.delete' then
    delete from public.operarios where id=(p_command->>'id')::uuid and organization_id=p_organization_id returning name into activity;
    if not found then raise exception 'Operario no encontrado.' using errcode='P0002'; end if;
    activity := 'Operario dado de baja: '||activity;
  when 'parte.create' then
    select * into tsk from public.tasks where id=(p_command->>'task_id')::uuid and organization_id=p_organization_id;
    if not found then raise exception 'Tarea no encontrada.' using errcode='P0002'; end if;
    if p_command->>'operario_id' is not null and not exists(select 1 from public.operarios where id=(p_command->>'operario_id')::uuid and organization_id=p_organization_id) then raise exception 'Ese operario no está en el equipo.' using errcode='23503'; end if;
    share_snapshot := coalesce(p_command->'snapshot','{}'::jsonb);
    if jsonb_typeof(share_snapshot)<>'object' or length(share_snapshot::text)>6000 then raise exception 'Datos del parte no válidos.' using errcode='22023'; end if;
    -- El token es el único secreto del enlace: 64 caracteres aleatorios (dos UUID v4 sin guiones).
    insert into public.task_shares(id,organization_id,task_id,operario_id,token,snapshot,created_by,created_by_name)
    values(coalesce((p_command->>'id')::uuid,gen_random_uuid()),p_organization_id,tsk.id,(p_command->>'operario_id')::uuid,
      replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),
      jsonb_build_object('direccion',left(coalesce(share_snapshot->>'direccion',''),300),'notas',left(coalesce(share_snapshot->>'notas',''),800),
        'contacto',left(coalesce(share_snapshot->>'contacto',''),120),'telefono',left(coalesce(share_snapshot->>'telefono',''),40),'para',left(coalesce(share_snapshot->>'para',''),120),
        'material',coalesce((select jsonb_agg(left(x.linea,160)) from (select jsonb_array_elements_text(case when jsonb_typeof(share_snapshot->'material')='array' then share_snapshot->'material' else '[]'::jsonb end) as linea limit 8) x),'[]'::jsonb)),
      auth.uid(),member.display_name);
    project := tsk.project_id; activity := 'Parte enviado: '||tsk.title;
  when 'parte.revoke' then
    update public.task_shares set revoked_at=now() where id=(p_command->>'id')::uuid and organization_id=p_organization_id and revoked_at is null returning task_id into new_id;
    if not found then raise exception 'Parte no encontrado.' using errcode='P0002'; end if;
    select project_id,title into project,activity from public.tasks where id=new_id;
    activity := 'Parte anulado: '||activity;
  when 'task.create' then
    insert into public.tasks(organization_id,project_id,title,trade,assignee,assignee_id,operario_id,due_date,weight)
    values(p_organization_id,project,private.required_text(p_command,'title'),private.required_text(p_command,'trade'),coalesce(assigned_name,''),assigned_id,assigned_operario,(p_command->>'due_date')::date,(p_command->>'weight')::integer);
    activity := 'Tarea planificada: '||(p_command->>'title');
  when 'task.toggle' then
    update public.tasks set status=p_command->>'status' where id=(p_command->>'id')::uuid and organization_id=p_organization_id returning project_id,title into project,activity;
    if not found then raise exception 'Tarea no encontrada.' using errcode='P0002'; end if;
    activity := case when p_command->>'status'='done' then 'Completada: ' else 'Reabierta: ' end||activity;
  when 'task.update' then
    if p_command ? 'weight' and ((p_command->>'weight')::integer < 1 or (p_command->>'weight')::integer > 100) then raise exception 'Campo no válido: weight' using errcode='22023'; end if;
    update public.tasks set
      title=case when p_command ? 'title' then private.required_text(p_command,'title') else title end,
      trade=case when p_command ? 'trade' then private.required_text(p_command,'trade') else trade end,
      assignee=case when has_assignment then assigned_name else assignee end,
      assignee_id=case when has_assignment then assigned_id else assignee_id end,
      operario_id=case when has_assignment then assigned_operario else operario_id end,
      due_date=case when p_command ? 'due_date' then (p_command->>'due_date')::date else due_date end,
      weight=case when p_command ? 'weight' then (p_command->>'weight')::integer else weight end
    where id=(p_command->>'id')::uuid and organization_id=p_organization_id returning project_id,title into project,activity;
    if not found then raise exception 'Tarea no encontrada.' using errcode='P0002'; end if;
    activity := 'Tarea actualizada: '||activity;
  when 'task.delete' then
    delete from public.tasks where id=(p_command->>'id')::uuid and organization_id=p_organization_id returning project_id,title into project,activity;
    if not found then raise exception 'Tarea no encontrada.' using errcode='P0002'; end if;
    activity := 'Tarea eliminada: '||activity;
  when 'purchase.create' then
    if p_command->>'article_id' is not null then
      select * into art from public.articles where id=(p_command->>'article_id')::uuid and organization_id=p_organization_id;
      if not found then raise exception 'Artículo no encontrado.' using errcode='P0002'; end if;
      if art.unit<>p_command->>'unit' then raise exception 'El artículo se mide en %: el pedido también.', art.unit using errcode='22023'; end if;
    end if;
    insert into public.purchases(organization_id,project_id,name,supplier,quantity,unit,article_id)
    values(p_organization_id,project,private.required_text(p_command,'name'),private.required_text(p_command,'supplier'),(p_command->>'quantity')::numeric,p_command->>'unit',art.id);
    activity := 'Material añadido: '||(p_command->>'name');
  when 'purchase.update' then
    select * into p from public.purchases where id=(p_command->>'id')::uuid and organization_id=p_organization_id for update;
    if not found then raise exception 'Pedido no encontrado.' using errcode='P0002'; end if;
    update public.purchases set status=case when p_command ? 'status' then p_command->>'status' else status end,
      received_quantity=case when p_command ? 'received_quantity' then (p_command->>'received_quantity')::numeric else received_quantity end,
      delivered_quantity=case when p_command ? 'delivered_quantity' then (p_command->>'delivered_quantity')::numeric else delivered_quantity end,
      assignee=case when has_assignment then assigned_name else assignee end,
      assignee_id=case when has_assignment then assigned_id else assignee_id end
    where id=p.id returning project_id,name,received_quantity,delivered_quantity into project,activity,new_received,new_delivered;
    -- Pedido ligado a un artículo de almacén: lo recibido entra en la nave y lo llevado a obra sale.
    if p.article_id is not null then
      select * into art from public.articles where id=p.article_id and organization_id=p_organization_id for update;
      if found and art.stocked then
        delta := new_received-p.received_quantity;
        if delta<>0 then
          update public.articles set stock_qty=stock_qty+delta where id=art.id returning stock_qty into after_qty;
          insert into public.stock_movements(organization_id,article_id,project_id,purchase_id,kind,quantity,stock_after,actor_name,actor_id) values(p_organization_id,art.id,project,p.id,'recepcion',delta,after_qty,member.display_name,auth.uid());
        end if;
        delta := -(new_delivered-p.delivered_quantity);
        if delta<>0 then
          update public.articles set stock_qty=stock_qty+delta where id=art.id returning stock_qty into after_qty;
          insert into public.stock_movements(organization_id,article_id,project_id,purchase_id,kind,quantity,stock_after,actor_name,actor_id) values(p_organization_id,art.id,project,p.id,'a_obra',delta,after_qty,member.display_name,auth.uid());
        end if;
      end if;
    end if;
    activity := 'Recepción actualizada: '||activity;
  when 'message.send' then
    insert into public.messages(organization_id,project_id,body,author_name,author_id) values(p_organization_id,project,private.required_text(p_command,'body',5000),member.display_name,auth.uid());
    activity := 'Mensaje en la conversación del proyecto';
  when 'message.edit' then
    select * into m from public.messages where id=(p_command->>'id')::uuid and organization_id=p_organization_id and deleted_at is null for update;
    if not found then raise exception 'Mensaje no encontrado.' using errcode='P0002'; end if;
    if coalesce(m.author_id=auth.uid(), m.author_name=member.display_name) is not true then raise exception 'Solo quien escribió el mensaje puede editarlo.' using errcode='42501'; end if;
    update public.messages set body=private.required_text(p_command,'body',5000), edited_at=now() where id=m.id;
    project := m.project_id; activity := 'Mensaje editado en la conversación';
  when 'message.delete' then
    select * into m from public.messages where id=(p_command->>'id')::uuid and organization_id=p_organization_id and deleted_at is null for update;
    if not found then raise exception 'Mensaje no encontrado.' using errcode='P0002'; end if;
    if coalesce(m.author_id=auth.uid(), m.author_name=member.display_name) is not true and member.role not in ('admin','office') then raise exception 'Solo quien escribió el mensaje, oficina o administración pueden borrarlo.' using errcode='42501'; end if;
    update public.messages set body='', deleted_at=now() where id=m.id;
    project := m.project_id; activity := 'Mensaje eliminado de la conversación';
  when 'message.react' then
    if p_command->>'emoji' not in ('👍','✅','❤️','👀','🙏','⚠️') then raise exception 'Reacción no admitida.' using errcode='22023'; end if;
    select * into m from public.messages where id=(p_command->>'id')::uuid and organization_id=p_organization_id and deleted_at is null for update;
    if not found then raise exception 'Mensaje no encontrado.' using errcode='P0002'; end if;
    if coalesce(m.reactions->(p_command->>'emoji'),'[]'::jsonb) ? member.display_name then
      update public.messages set reactions = case when jsonb_array_length(coalesce(reactions->(p_command->>'emoji'),'[]'::jsonb)) <= 1 then reactions - (p_command->>'emoji') else jsonb_set(reactions, array[p_command->>'emoji'], (select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(reactions->(p_command->>'emoji')) x where x <> to_jsonb(member.display_name))) end where id=m.id;
    else
      update public.messages set reactions = jsonb_set(reactions, array[p_command->>'emoji'], coalesce(reactions->(p_command->>'emoji'),'[]'::jsonb) || to_jsonb(member.display_name), true) where id=m.id;
    end if;
    project := m.project_id; activity := 'Reacción '||(p_command->>'emoji')||' en la conversación';
  when 'document.add' then
    if p_command->>'storage_path' not like p_organization_id::text||'/'||project::text||'/%' then raise exception 'Ruta de archivo no válida.' using errcode='22023'; end if;
    select o.metadata into metadata from storage.objects o where o.bucket_id='project-files' and o.name=p_command->>'storage_path';
    if not found or metadata->>'size' is null or metadata->>'mimetype' is null then raise exception 'El archivo no se ha subido correctamente.' using errcode='22023'; end if;
    if (metadata->>'size')::bigint is distinct from (p_command->>'size_bytes')::bigint or metadata->>'mimetype' is distinct from p_command->>'mime_type' then raise exception 'Los metadatos no coinciden con el archivo subido.' using errcode='22023'; end if;
    insert into public.documents(organization_id,project_id,name,category,storage_path,mime_type,size_bytes)
    values(p_organization_id,project,private.required_text(p_command,'name'),p_command->>'category',private.required_text(p_command,'storage_path'),metadata->>'mimetype',(metadata->>'size')::bigint);
    activity := 'Documento añadido: '||(p_command->>'name');
  when 'certification.create' then
    if b.approved_version_id is distinct from v.id then raise exception 'Selecciona el presupuesto aprobado vigente del proyecto.' using errcode='22023'; end if;
    base := private.budget_base(v.items);
    select coalesce(sum(c.amount),0) into reserved from public.certifications c join public.budget_versions bv on bv.id=c.budget_version_id where bv.budget_id=b.id;
    if reserved+(p_command->>'amount')::bigint > base then raise exception 'El importe supera el saldo del presupuesto aprobado.' using errcode='22023'; end if;
    insert into public.certifications(organization_id,project_id,budget_version_id,title,amount)
    values(p_organization_id,project,v.id,private.required_text(p_command,'title'),(p_command->>'amount')::bigint);
    activity := 'Borrador de certificación: '||(p_command->>'title');
  when 'invoice.create' then
    base := (p_command->>'base')::bigint;
    if p_command->>'certification_id' is not null then
      select * into cert from public.certifications where id=(p_command->>'certification_id')::uuid and organization_id=p_organization_id and project_id=project;
      if not found then raise exception 'Cobro no encontrado.' using errcode='P0002'; end if;
      if exists(select 1 from public.invoices where certification_id=cert.id) then raise exception 'Ese cobro ya tiene factura.' using errcode='23505'; end if;
      base := cert.amount;
    end if;
    vat := (p_command->>'vat_rate')::numeric;
    if base is null or base<=0 or base>100000000 or vat is null or vat<0 or vat>30 then raise exception 'Importe o IVA no válidos.' using errcode='22023'; end if;
    select client_name into client from public.projects where id=project and organization_id=p_organization_id;
    insert into public.invoices(organization_id,project_id,certification_id,client_name,concept,base,vat_rate,tax,total,due_date,created_by_name)
    values(p_organization_id,project,cert.id,client,private.required_text(p_command,'concept'),base,vat,round(base*vat/100)::bigint,base+round(base*vat/100)::bigint,(p_command->>'due_date')::date,member.display_name);
    activity := 'Factura en borrador: '||(p_command->>'concept');
  when 'invoice.update' then
    select * into inv from public.invoices where id=(p_command->>'id')::uuid and organization_id=p_organization_id for update;
    if not found then raise exception 'Factura no encontrada.' using errcode='P0002'; end if;
    if inv.status<>'draft' then raise exception 'Una factura enviada no se edita.' using errcode='22023'; end if;
    importe := coalesce((p_command->>'base')::bigint,inv.base); vat := coalesce((p_command->>'vat_rate')::numeric,inv.vat_rate);
    if inv.certification_id is not null and importe<>inv.base then raise exception 'El importe sale del cobro preparado.' using errcode='22023'; end if;
    if importe<=0 or importe>100000000 or vat<0 or vat>30 then raise exception 'Importe o IVA no válidos.' using errcode='22023'; end if;
    update public.invoices set concept=case when p_command ? 'concept' then private.required_text(p_command,'concept') else concept end,base=importe,vat_rate=vat,tax=round(importe*vat/100)::bigint,total=importe+round(importe*vat/100)::bigint,
      due_date=case when p_command ? 'due_date' then (p_command->>'due_date')::date else due_date end,updated_at=now()
    where id=inv.id;
    project := inv.project_id; activity := 'Factura en borrador actualizada: '||coalesce(p_command->>'concept',inv.concept);
  when 'invoice.delete' then
    select * into inv from public.invoices where id=(p_command->>'id')::uuid and organization_id=p_organization_id for update;
    if not found then raise exception 'Factura no encontrada.' using errcode='P0002'; end if;
    if inv.status<>'draft' then raise exception 'Una factura enviada no se borra: el número debe quedar registrado.' using errcode='22023'; end if;
    delete from public.invoices where id=inv.id;
    project := inv.project_id; activity := 'Factura en borrador eliminada: '||inv.concept;
  when 'invoice.send' then
    select * into inv from public.invoices where id=(p_command->>'id')::uuid and organization_id=p_organization_id for update;
    if not found then raise exception 'Factura no encontrada.' using errcode='P0002'; end if;
    if inv.status<>'draft' then raise exception 'Esta factura ya está enviada.' using errcode='22023'; end if;
    due := (p_command->>'due_date')::date;
    if due is null or due<hoy then raise exception 'El vencimiento no puede ser anterior a hoy.' using errcode='22023'; end if;
    -- La organización está bloqueada y las enviadas no se borran: la serie es correlativa y sin huecos.
    year_number := extract(year from hoy)::integer;
    select coalesce(max(number_seq),0)+1 into sequence_number from public.invoices where organization_id=p_organization_id and number_year=year_number;
    update public.invoices set status='sent',number=year_number||'-'||lpad(sequence_number::text,4,'0'),number_year=year_number,number_seq=sequence_number,issue_date=hoy,due_date=due,updated_at=now() where id=inv.id;
    project := inv.project_id; activity := 'Factura '||year_number||'-'||lpad(sequence_number::text,4,'0')||' enviada: '||inv.concept;
  when 'invoice.pay' then
    select * into inv from public.invoices where id=(p_command->>'id')::uuid and organization_id=p_organization_id for update;
    if not found then raise exception 'Factura no encontrada.' using errcode='P0002'; end if;
    if inv.status<>'sent' then raise exception 'Solo se cobra una factura enviada.' using errcode='22023'; end if;
    if (p_command->>'paid_on')::date is null then raise exception 'Indica la fecha de cobro.' using errcode='22023'; end if;
    update public.invoices set status='paid',paid_on=(p_command->>'paid_on')::date,updated_at=now() where id=inv.id;
    project := inv.project_id; activity := 'Factura '||inv.number||' cobrada';
  when 'invoice.unpay' then
    select * into inv from public.invoices where id=(p_command->>'id')::uuid and organization_id=p_organization_id for update;
    if not found then raise exception 'Factura no encontrada.' using errcode='P0002'; end if;
    if inv.status<>'paid' then raise exception 'Esta factura no está cobrada.' using errcode='22023'; end if;
    update public.invoices set status='sent',paid_on=null,updated_at=now() where id=inv.id;
    project := inv.project_id; activity := 'Factura '||inv.number||' vuelve a pendiente de cobro';
  else raise exception 'Comando no admitido.' using errcode='22023';
  end case;
  insert into public.activities(organization_id,project_id,text,actor_name,actor_id,command_type)
  values(p_organization_id,project,activity,member.display_name,auth.uid(),action);
  insert into public.command_receipts(organization_id,user_id,request_id,command) values(p_organization_id,auth.uid(),p_request_id,p_command);
end $$;
