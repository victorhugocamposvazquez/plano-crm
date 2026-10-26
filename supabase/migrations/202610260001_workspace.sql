-- PLANO: aislamiento por organización y escritura exclusivamente por comandos.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  project_counter integer not null default 0,
  created_at timestamptz not null default now()
);
create table public.organization_members (
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id),
  display_name text not null check (length(display_name) between 1 and 120),
  role text not null check (role in ('admin','office','manager','site','viewer')),
  primary key (organization_id,user_id)
);
create function private.member_role(org uuid) returns text
language sql stable security definer set search_path = '' as $$
  select role from public.organization_members where organization_id = org and user_id = auth.uid()
$$;
revoke all on function private.member_role(uuid) from public;
grant execute on function private.member_role(uuid) to authenticated;

create function private.valid_items(items jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare i jsonb; ids uuid[] := '{}'; total numeric := 0;
begin
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 500 then return false; end if;
  for i in select value from jsonb_array_elements(items) loop
    if not (i ?& array['id','chapter','description','quantity','unit','unit_price','adjustment_percent','vat_rate','inclusion']) then return false; end if;
    if jsonb_typeof(i->'id') is distinct from 'string' or jsonb_typeof(i->'unit') is distinct from 'string' or jsonb_typeof(i->'inclusion') is distinct from 'string' then return false; end if;
    if (i->>'id')::uuid = any(ids) then return false; end if;
    ids := array_append(ids, (i->>'id')::uuid);
    if jsonb_typeof(i->'chapter') <> 'string' or length(btrim(i->>'chapter')) not between 1 and 120
      or jsonb_typeof(i->'description') <> 'string' or length(btrim(i->>'description')) not between 1 and 2000
      or i->>'unit' not in ('m²','ml','ud','h','global') or i->>'inclusion' not in ('included','optional','excluded') then return false; end if;
    if jsonb_typeof(i->'quantity') <> 'number' or (i->>'quantity')::numeric not between 0 and 1000000
      or (i->>'quantity')::numeric <> round((i->>'quantity')::numeric,3)
      or jsonb_typeof(i->'unit_price') <> 'number' or (i->>'unit_price')::numeric not between 0 and 100000000
      or (i->>'unit_price')::numeric <> trunc((i->>'unit_price')::numeric)
      or jsonb_typeof(i->'adjustment_percent') <> 'number' or (i->>'adjustment_percent')::numeric not between -50 and 100
      or (i->>'adjustment_percent')::numeric <> round((i->>'adjustment_percent')::numeric,2)
      or jsonb_typeof(i->'vat_rate') <> 'number' or (i->>'vat_rate')::numeric not between 0 and 30
      or (i->>'vat_rate')::numeric <> round((i->>'vat_rate')::numeric,2) then return false; end if;
    total := total + round((i->>'quantity')::numeric * (i->>'unit_price')::numeric * (1 + (i->>'adjustment_percent')::numeric/100)) * 1.3;
    if total > 9007199254740991 then return false; end if;
  end loop;
  return true;
exception when others then return false;
end $$;
create function private.budget_base(items jsonb) returns bigint
language sql immutable set search_path = '' as $$
  select coalesce(sum(round((i->>'quantity')::numeric * (i->>'unit_price')::numeric * (1 + (i->>'adjustment_percent')::numeric/100))),0)::bigint
  from jsonb_array_elements(items) i where i->>'inclusion' = 'included'
$$;

create table public.projects (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  code text not null, name text not null check (length(btrim(name)) between 1 and 500),
  client_name text not null check (length(btrim(client_name)) between 1 and 500), location text not null default '' check (length(location)<=500),
  kind text not null check (kind in ('integral','partial','carpentry')),
  status text not null default 'lead' check (status in ('lead','estimating','planning','active','completed')),
  created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,code)
);
create table public.articles (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  code text not null check (length(btrim(code)) between 1 and 500), name text not null check (length(btrim(name)) between 1 and 500),
  chapter text not null check (length(btrim(chapter)) between 1 and 120), unit text not null check (unit in ('m²','ml','ud','h','global')),
  unit_price bigint not null check (unit_price between 0 and 100000000), vat_rate numeric not null check (vat_rate between 0 and 30 and vat_rate=round(vat_rate,2))
);
create unique index articles_code_org on public.articles(organization_id, lower(code));
create table public.budgets (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null,
  project_id uuid not null, title text not null check (length(btrim(title)) between 1 and 500), approved_version_id uuid,
  created_at timestamptz not null default now(), unique(organization_id,id),
  foreign key(organization_id,project_id) references public.projects(organization_id,id)
);
create table public.budget_versions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, budget_id uuid not null,
  number integer not null check(number>0), status text not null default 'draft' check(status in ('draft','issued','approved','superseded')),
  draft_revision integer not null default 0 check(draft_revision>=0),
  items jsonb not null default '[]' check(private.valid_items(items)), notes text not null default '' check(length(notes)<=5000),
  change_reason text not null check(length(btrim(change_reason)) between 1 and 500), created_by_name text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  approved_at timestamptz, approval_reference text check(length(btrim(approval_reference)) between 1 and 500),
  foreign key(organization_id,budget_id) references public.budgets(organization_id,id),
  unique(organization_id,budget_id,id), unique(organization_id,id), unique(budget_id,number),
  check(status not in ('approved','superseded') or (approved_at is not null and approval_reference is not null))
);
create unique index one_draft_per_budget on public.budget_versions(budget_id) where status='draft';
create unique index one_approved_per_budget on public.budget_versions(budget_id) where status='approved';
alter table public.budgets add constraint approved_version_same_budget
  foreign key(organization_id,id,approved_version_id) references public.budget_versions(organization_id,budget_id,id) deferrable initially deferred;
create function private.protect_revision() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status<>'draft' and row(new.organization_id,new.budget_id,new.number,new.items,new.notes,new.change_reason,new.created_by_name,new.created_at,new.draft_revision)
    is distinct from row(old.organization_id,old.budget_id,old.number,old.items,old.notes,old.change_reason,old.created_by_name,old.created_at,old.draft_revision) then
    raise exception 'Una revisión cerrada conserva su contenido original.' using errcode='22023';
  end if;
  if (old.status='draft' and new.status not in ('draft','issued')) or (old.status='issued' and new.status not in ('issued','approved'))
    or (old.status='approved' and new.status not in ('approved','superseded')) or (old.status='superseded' and new.status<>'superseded') then
    raise exception 'Transición de revisión no permitida.' using errcode='22023';
  end if;
  if old.status in ('approved','superseded') and row(new.approved_at,new.approval_reference) is distinct from row(old.approved_at,old.approval_reference) then
    raise exception 'La referencia de aprobación se conserva en el historial.' using errcode='22023';
  end if;
  return new;
end $$;
create trigger immutable_closed_revision before update on public.budget_versions for each row execute function private.protect_revision();
create table public.tasks (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, project_id uuid not null,
  title text not null check(length(btrim(title)) between 1 and 500), trade text not null check(length(btrim(trade)) between 1 and 500),
  assignee text not null default '' check(length(assignee)<=120), due_date date not null,
  status text not null default 'pending' check(status in ('pending','done')), weight integer not null check(weight between 1 and 100),
  foreign key(organization_id,project_id) references public.projects(organization_id,id)
);
create table public.purchases (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, project_id uuid not null,
  name text not null check(length(btrim(name)) between 1 and 500), supplier text not null check(length(btrim(supplier)) between 1 and 500),
  quantity numeric not null check(quantity>0 and quantity<=1000000), unit text not null check(unit in ('m²','ml','ud','h','global')),
  received_quantity numeric not null default 0, delivered_quantity numeric not null default 0,
  status text not null default 'planned' check(status in ('planned','ordered','received','delivered')),
  check(delivered_quantity>=0 and delivered_quantity<=received_quantity and received_quantity<=quantity),
  check(status<>'planned' or received_quantity=0), check(status<>'received' or received_quantity=quantity), check(status<>'delivered' or delivered_quantity=quantity),
  foreign key(organization_id,project_id) references public.projects(organization_id,id)
);
create table public.documents (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, project_id uuid not null,
  name text not null check(length(btrim(name)) between 1 and 500),
  category text not null check(category in ('plan','contract','technical','before','during','after','other')),
  storage_path text not null unique, mime_type text not null check(mime_type in ('application/pdf','image/jpeg','image/png','image/webp','video/mp4')),
  size_bytes bigint not null check(size_bytes>0 and size_bytes<=52428800), created_at timestamptz not null default now(),
  check(storage_path like organization_id::text||'/'||project_id::text||'/%'),
  foreign key(organization_id,project_id) references public.projects(organization_id,id)
);
create table public.messages (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, project_id uuid not null,
  body text not null check(length(btrim(body)) between 1 and 5000), author_name text not null,
  created_at timestamptz not null default now(), foreign key(organization_id,project_id) references public.projects(organization_id,id)
);
create table public.activities (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), project_id uuid,
  text text not null, actor_name text not null, actor_id uuid not null references auth.users(id),
  command_type text not null, created_at timestamptz not null default now(),
  foreign key(organization_id,project_id) references public.projects(organization_id,id)
);
create table public.certifications (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, project_id uuid not null, budget_version_id uuid not null,
  title text not null check(length(btrim(title)) between 1 and 500), amount bigint not null check(amount>0 and amount<=100000000),
  status text not null default 'draft' check(status='draft'), created_at timestamptz not null default now(),
  foreign key(organization_id,project_id) references public.projects(organization_id,id),
  foreign key(organization_id,budget_version_id) references public.budget_versions(organization_id,id)
);
create table public.command_receipts (
  organization_id uuid not null references public.organizations(id), user_id uuid not null references auth.users(id),
  request_id uuid not null, command jsonb not null, created_at timestamptz not null default now(),
  primary key(organization_id,user_id,request_id)
);
alter table public.command_receipts enable row level security;
revoke all on public.command_receipts from anon,authenticated;

-- Las tablas permiten lectura a miembros; las mutaciones pasan por execute_command.
do $$ declare t text; begin
  foreach t in array array['projects','articles','budgets','budget_versions','tasks','purchases','documents','messages','activities','certifications'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy member_read on public.%I for select to authenticated using (private.member_role(organization_id) is not null)',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('create index %I on public.%I(organization_id)',t||'_org',t);
  end loop;
end $$;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
create policy member_read on public.organizations for select to authenticated using(private.member_role(id) is not null);
create policy own_memberships on public.organization_members for select to authenticated using(user_id=auth.uid());
revoke all on public.organizations, public.organization_members from anon, authenticated;
grant select on public.organizations, public.organization_members to authenticated;
create index budgets_project on public.budgets(project_id);
create index tasks_project_due on public.tasks(project_id,due_date);
create index messages_project_created on public.messages(project_id,created_at);
create index activities_org_created on public.activities(organization_id,created_at desc);

create function private.required_text(j jsonb, k text, max_length integer default 500) returns text
language plpgsql immutable set search_path = '' as $$
declare v text := btrim(j->>k);
begin
  if jsonb_typeof(j->k) is distinct from 'string' or v is null or length(v) not between 1 and max_length then
    raise exception 'Campo no válido: %',k using errcode='22023';
  end if;
  return v;
end $$;

create function public.execute_command(p_organization_id uuid, p_command jsonb, p_request_id uuid default gen_random_uuid()) returns void
language plpgsql security definer set search_path = '' as $$
declare
  member public.organization_members; v public.budget_versions; b public.budgets; p public.purchases;
  action text := p_command->>'type'; project uuid; new_id uuid; sequence_number integer; item jsonb;
  activity text; base bigint; reserved bigint; metadata jsonb; previous_command jsonb;
begin
  select * into member from public.organization_members where organization_id=p_organization_id and user_id=auth.uid();
  if not found or auth.uid() is null or member.role='viewer' then raise exception 'No tienes permiso para esta acción.' using errcode='42501'; end if;
  if member.role='site' and action not in ('task.toggle','message.send','document.add','purchase.update') then raise exception 'No tienes permiso para esta acción.' using errcode='42501'; end if;
  if action in ('budget.approve','certification.create') and member.role not in ('admin','office') then raise exception 'Esta acción corresponde a administración.' using errcode='42501'; end if;
  -- Serializa los comandos de una organización: numeración, aprobación y saldo son atómicos.
  perform id from public.organizations where id=p_organization_id for update;
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
  case action
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
    insert into public.articles(organization_id,code,name,chapter,unit,unit_price,vat_rate)
    values(p_organization_id,private.required_text(p_command,'code'),private.required_text(p_command,'name'),private.required_text(p_command,'chapter',120),p_command->>'unit',(p_command->>'unit_price')::bigint,(p_command->>'vat_rate')::numeric);
    activity := 'Artículo creado: '||(p_command->>'name');
  when 'task.create' then
    insert into public.tasks(organization_id,project_id,title,trade,assignee,due_date,weight)
    values(p_organization_id,project,private.required_text(p_command,'title'),private.required_text(p_command,'trade'),coalesce(p_command->>'assignee',''),(p_command->>'due_date')::date,(p_command->>'weight')::integer);
    activity := 'Tarea planificada: '||(p_command->>'title');
  when 'task.toggle' then
    update public.tasks set status=p_command->>'status' where id=(p_command->>'id')::uuid and organization_id=p_organization_id returning project_id,title into project,activity;
    if not found then raise exception 'Tarea no encontrada.' using errcode='P0002'; end if;
    activity := case when p_command->>'status'='done' then 'Completada: ' else 'Reabierta: ' end||activity;
  when 'purchase.create' then
    insert into public.purchases(organization_id,project_id,name,supplier,quantity,unit)
    values(p_organization_id,project,private.required_text(p_command,'name'),private.required_text(p_command,'supplier'),(p_command->>'quantity')::numeric,p_command->>'unit');
    activity := 'Material añadido: '||(p_command->>'name');
  when 'purchase.update' then
    update public.purchases set status=p_command->>'status',received_quantity=(p_command->>'received_quantity')::numeric,delivered_quantity=(p_command->>'delivered_quantity')::numeric
    where id=(p_command->>'id')::uuid and organization_id=p_organization_id returning project_id,name into project,activity;
    if not found then raise exception 'Pedido no encontrado.' using errcode='P0002'; end if;
    activity := 'Recepción actualizada: '||activity;
  when 'message.send' then
    insert into public.messages(organization_id,project_id,body,author_name) values(p_organization_id,project,private.required_text(p_command,'body',5000),member.display_name);
    activity := 'Mensaje en la conversación del proyecto';
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
  else raise exception 'Comando no admitido.' using errcode='22023';
  end case;
  insert into public.activities(organization_id,project_id,text,actor_name,actor_id,command_type)
  values(p_organization_id,project,activity,member.display_name,auth.uid(),action);
  insert into public.command_receipts(organization_id,user_id,request_id,command) values(p_organization_id,auth.uid(),p_request_id,p_command);
end $$;

-- Las funciones auxiliares no son endpoints; nunca se usa service_role en el navegador.
revoke all on function private.valid_items(jsonb), private.budget_base(jsonb), private.required_text(jsonb,text,integer) from public;
revoke all on function private.protect_revision() from public;
revoke all on function public.execute_command(uuid,jsonb,uuid) from public, anon;
grant execute on function public.execute_command(uuid,jsonb,uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('project-files','project-files',false,52428800,array['application/pdf','image/jpeg','image/png','image/webp','video/mp4']);
create function private.file_access(path text, writable boolean) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare org uuid; project uuid; role text;
begin
  if path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}$' then return false; end if;
  org := split_part(path,'/',1)::uuid; project := split_part(path,'/',2)::uuid;
  role := private.member_role(org);
  return role is not null and (not writable or role<>'viewer') and exists(select 1 from public.projects p where p.id=project and p.organization_id=org);
exception when others then return false;
end $$;
revoke all on function private.file_access(text,boolean) from public;
grant execute on function private.file_access(text,boolean) to authenticated;
create policy project_file_insert on storage.objects for insert to authenticated
  with check(bucket_id='project-files' and private.file_access(name,true));
create policy project_file_select on storage.objects for select to authenticated
  using(bucket_id='project-files' and private.file_access(name,false));
-- Sin UPDATE/DELETE: no se sobreescriben ni se borran originales desde el cliente.
