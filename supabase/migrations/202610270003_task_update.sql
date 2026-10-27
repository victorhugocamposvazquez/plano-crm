-- Editar y eliminar tareas (Claude, 2026-10-27; área de Codex). `task.update` cambia solo los campos enviados
-- (título, oficio, responsable, fecha, peso) con las mismas reglas que al crear; `task.delete` la borra.
-- Equipo de obra sigue pudiendo solo completar o reabrir.

create or replace function public.execute_command(p_organization_id uuid, p_command jsonb, p_request_id uuid default gen_random_uuid()) returns void
language plpgsql security definer set search_path = '' as $$
declare
  member public.organization_members; v public.budget_versions; b public.budgets; p public.purchases; m public.messages;
  action text := p_command->>'type'; project uuid; new_id uuid; sequence_number integer; item jsonb;
  activity text; base bigint; reserved bigint; metadata jsonb; previous_command jsonb;
begin
  select * into member from public.organization_members where organization_id=p_organization_id and user_id=auth.uid();
  if not found or auth.uid() is null or member.role='viewer' then raise exception 'No tienes permiso para esta acción.' using errcode='42501'; end if;
  if member.role='site' and action not in ('task.toggle','message.send','message.edit','message.delete','message.react','document.add','purchase.update') then raise exception 'No tienes permiso para esta acción.' using errcode='42501'; end if;
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
  else raise exception 'Comando no admitido.' using errcode='22023';
  end case;
  insert into public.activities(organization_id,project_id,text,actor_name,actor_id,command_type)
  values(p_organization_id,project,activity,member.display_name,auth.uid(),action);
  insert into public.command_receipts(organization_id,user_id,request_id,command) values(p_organization_id,auth.uid(),p_request_id,p_command);
end $$;
