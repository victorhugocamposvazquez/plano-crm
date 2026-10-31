-- Facturas (Claude, 2026-10-31; área de Codex, a petición de Hugo). Plano las registra y les hace seguimiento:
-- no sustituyen a la factura oficial. El número se asigna al enviar, en serie anual correlativa y sin huecos;
-- las enviadas no se editan ni se borran. «Vencida» no se guarda: es una enviada con el vencimiento pasado.

create table public.invoices (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, project_id uuid not null,
  certification_id uuid references public.certifications(id),
  client_name text not null, concept text not null check(length(btrim(concept)) between 1 and 500),
  base bigint not null check(base>0 and base<=100000000), vat_rate numeric(5,2) not null check(vat_rate between 0 and 30),
  tax bigint not null check(tax>=0), total bigint not null check(total=base+tax),
  status text not null default 'draft' check(status in ('draft','sent','paid')),
  number text, number_year integer, number_seq integer,
  issue_date date, due_date date, paid_on date,
  created_by_name text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(organization_id,project_id) references public.projects(organization_id,id),
  unique(organization_id,number), unique(organization_id,number_year,number_seq), unique(certification_id),
  check((status='draft' and number is null and number_year is null and number_seq is null and issue_date is null and paid_on is null)
    or (status='sent' and number is not null and issue_date is not null and due_date is not null and paid_on is null)
    or (status='paid' and number is not null and issue_date is not null and due_date is not null and paid_on is not null))
);
create index invoices_project on public.invoices(organization_id,project_id);
alter table public.invoices enable row level security;
revoke all on public.invoices from public,anon,authenticated;
grant select on public.invoices to authenticated;
create policy member_read on public.invoices for select to authenticated using (private.member_role(organization_id) is not null);

create or replace function public.execute_command(p_organization_id uuid, p_command jsonb, p_request_id uuid default gen_random_uuid()) returns void
language plpgsql security definer set search_path = '' as $$
declare
  member public.organization_members; v public.budget_versions; b public.budgets; p public.purchases; m public.messages;
  action text := p_command->>'type'; project uuid; new_id uuid; sequence_number integer; item jsonb;
  activity text; base bigint; reserved bigint; metadata jsonb; previous_command jsonb;
  inv public.invoices; cert public.certifications; vat numeric; client text; hoy date := (now() at time zone 'Europe/Madrid')::date; due date; year_number integer; importe bigint;
begin
  select * into member from public.organization_members where organization_id=p_organization_id and user_id=auth.uid();
  if not found or auth.uid() is null or member.role='viewer' then raise exception 'No tienes permiso para esta acción.' using errcode='42501'; end if;
  if member.role='site' and action not in ('task.toggle','message.send','message.edit','message.delete','message.react','document.add','purchase.update') then raise exception 'No tienes permiso para esta acción.' using errcode='42501'; end if;
  if action in ('budget.approve','certification.create') and member.role not in ('admin','office') then raise exception 'Esta acción corresponde a administración.' using errcode='42501'; end if;
  if action like 'invoice.%' and member.role not in ('admin','office') then raise exception 'Esta acción corresponde a administración.' using errcode='42501'; end if;
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
  when 'article.update' then
    if p_command ? 'code' and exists(select 1 from public.articles where organization_id=p_organization_id and lower(code)=lower(p_command->>'code') and id<>(p_command->>'id')::uuid) then raise exception 'Ya existe un artículo con esa referencia.' using errcode='23505'; end if;
    if p_command ? 'unit' and p_command->>'unit' not in ('m²','ml','ud','h','global') then raise exception 'Campo no válido: unit' using errcode='22023'; end if;
    if p_command ? 'unit_price' and ((p_command->>'unit_price')::bigint < 0 or (p_command->>'unit_price')::bigint > 100000000) then raise exception 'Campo no válido: unit_price' using errcode='22023'; end if;
    if p_command ? 'vat_rate' and ((p_command->>'vat_rate')::numeric < 0 or (p_command->>'vat_rate')::numeric > 30) then raise exception 'Campo no válido: vat_rate' using errcode='22023'; end if;
    update public.articles set
      code=case when p_command ? 'code' then private.required_text(p_command,'code') else code end,
      name=case when p_command ? 'name' then private.required_text(p_command,'name') else name end,
      chapter=case when p_command ? 'chapter' then private.required_text(p_command,'chapter',120) else chapter end,
      unit=case when p_command ? 'unit' then p_command->>'unit' else unit end,
      unit_price=case when p_command ? 'unit_price' then (p_command->>'unit_price')::bigint else unit_price end,
      vat_rate=case when p_command ? 'vat_rate' then (p_command->>'vat_rate')::numeric else vat_rate end
    where id=(p_command->>'id')::uuid and organization_id=p_organization_id returning name into activity;
    if not found then raise exception 'Artículo no encontrado.' using errcode='P0002'; end if;
    activity := 'Artículo actualizado: '||activity;
  when 'article.delete' then
    delete from public.articles where id=(p_command->>'id')::uuid and organization_id=p_organization_id returning name into activity;
    if not found then raise exception 'Artículo no encontrado.' using errcode='P0002'; end if;
    activity := 'Artículo eliminado: '||activity;
  when 'task.create' then
    insert into public.tasks(organization_id,project_id,title,trade,assignee,due_date,weight)
    values(p_organization_id,project,private.required_text(p_command,'title'),private.required_text(p_command,'trade'),coalesce(p_command->>'assignee',''),(p_command->>'due_date')::date,(p_command->>'weight')::integer);
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
      assignee=case when p_command ? 'assignee' then left(coalesce(p_command->>'assignee',''),120) else assignee end,
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
    insert into public.purchases(organization_id,project_id,name,supplier,quantity,unit)
    values(p_organization_id,project,private.required_text(p_command,'name'),private.required_text(p_command,'supplier'),(p_command->>'quantity')::numeric,p_command->>'unit');
    activity := 'Material añadido: '||(p_command->>'name');
  when 'purchase.update' then
    update public.purchases set status=p_command->>'status',received_quantity=(p_command->>'received_quantity')::numeric,delivered_quantity=(p_command->>'delivered_quantity')::numeric
    where id=(p_command->>'id')::uuid and organization_id=p_organization_id returning project_id,name into project,activity;
    if not found then raise exception 'Pedido no encontrado.' using errcode='P0002'; end if;
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
