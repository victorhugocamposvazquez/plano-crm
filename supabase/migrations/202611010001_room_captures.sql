-- Captura declarada por zonas y procedencia congelada al incorporar al presupuesto.
create table public.room_captures (
  organization_id uuid not null, project_id uuid primary key, revision integer not null check(revision>0),
  survey jsonb not null check(jsonb_typeof(survey)='object' and octet_length(survey::text)<=1048576),
  updated_at timestamptz not null default statement_timestamp(), updated_by_name text not null,
  foreign key(organization_id,project_id) references public.projects(organization_id,id)
);
create table public.room_capture_imports (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, project_id uuid not null,
  version_id uuid not null, capture_revision integer not null,
  survey jsonb not null, items jsonb not null check(private.valid_items(items)),
  created_at timestamptz not null default statement_timestamp(), created_by_name text not null,
  foreign key(organization_id,project_id) references public.projects(organization_id,id),
  foreign key(organization_id,version_id) references public.budget_versions(organization_id,id),
  unique(version_id,capture_revision)
);
alter table public.room_captures enable row level security;
alter table public.room_capture_imports enable row level security;
revoke all on public.room_captures,public.room_capture_imports from public,anon,authenticated;
grant select on public.room_captures,public.room_capture_imports to authenticated;
create policy member_read on public.room_captures for select to authenticated using(private.member_role(organization_id) is not null);
create policy member_read on public.room_capture_imports for select to authenticated using(private.member_role(organization_id) is not null);

create function public.save_room_capture(p_organization_id uuid,p_project_id uuid,p_expected_revision integer,p_survey jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare member public.organization_members; current_revision integer; result public.room_captures; source jsonb; doc public.documents;
begin
  select * into member from public.organization_members where organization_id=p_organization_id and user_id=auth.uid();
  if not found or member.role not in ('admin','office','manager') then raise exception 'No tienes permiso para esta acción.' using errcode='42501'; end if;
  perform id from public.organizations where id=p_organization_id for update;
  if not exists(select 1 from public.projects where id=p_project_id and organization_id=p_organization_id) then raise exception 'Proyecto no encontrado.' using errcode='P0002'; end if;
  if p_survey is null or jsonb_typeof(p_survey)<>'object' or octet_length(p_survey::text)>1048576
    or (p_survey->>'project_id')::uuid is distinct from p_project_id or p_survey->>'schema_version' is distinct from '1'
    or jsonb_typeof(p_survey->'rooms') is distinct from 'array' or jsonb_typeof(p_survey->'sources') is distinct from 'array'
    or length(btrim(coalesce(p_survey->>'scope','')))=0 then raise exception 'Captura no válida.' using errcode='22023'; end if;
  if jsonb_array_length(p_survey->'rooms') not between 1 and 50 or jsonb_array_length(p_survey->'sources')>100 then raise exception 'Captura fuera de límites.' using errcode='22023'; end if;
  select * into result from public.room_captures where project_id=p_project_id for update;
  current_revision:=result.revision;
  if current_revision=p_expected_revision+1 and result.survey=p_survey then return to_jsonb(result); end if;
  if p_expected_revision is null or p_expected_revision<>coalesce(current_revision,0) then raise exception 'Otra persona ha actualizado la captura.' using errcode='40001'; end if;
  for source in select value from jsonb_array_elements(p_survey->'sources') loop
    if source->>'document_id' is not null then
      select * into doc from public.documents where id=(source->>'document_id')::uuid and organization_id=p_organization_id and project_id=p_project_id;
      if not found then raise exception 'Documento de otro proyecto.' using errcode='23503'; end if;
      if ((source->>'kind') in ('photo','panorama') and doc.mime_type not in ('image/jpeg','image/png','image/webp'))
        or (source->>'kind'='pdf' and doc.mime_type<>'application/pdf') or (source->>'kind'='video' and doc.mime_type<>'video/mp4') then raise exception 'Tipo de documento incompatible.' using errcode='22023'; end if;
    elsif source->>'kind' not in ('manual','voice','laser_measure') then raise exception 'Falta el original de la fuente.' using errcode='22023'; end if;
  end loop;
  insert into public.room_captures(organization_id,project_id,revision,survey,updated_by_name)
    values(p_organization_id,p_project_id,coalesce(current_revision,0)+1,p_survey,member.display_name)
    on conflict(project_id) do update set revision=excluded.revision,survey=excluded.survey,updated_by_name=excluded.updated_by_name,updated_at=statement_timestamp()
    returning * into result;
  return to_jsonb(result);
end $$;
revoke all on function public.save_room_capture(uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.save_room_capture(uuid,uuid,integer,jsonb) to authenticated;

create function public.apply_room_capture(p_organization_id uuid,p_project_id uuid,p_capture_revision integer,p_version_id uuid,p_expected_revision integer,p_items jsonb,p_reviewed boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare member public.organization_members; capture public.room_captures; v public.budget_versions;
  result public.room_capture_imports; item jsonb; previous_item jsonb; current_item jsonb; selection jsonb; article public.articles;
  combined jsonb; work_count integer; room_data jsonb; measurement_id jsonb; measurement jsonb; source jsonb; computed_quantity numeric;
begin
  select * into member from public.organization_members where organization_id=p_organization_id and user_id=auth.uid();
  if not found or member.role not in ('admin','office','manager') then raise exception 'No tienes permiso para esta acción.' using errcode='42501'; end if;
  perform id from public.organizations where id=p_organization_id for update;
  select * into capture from public.room_captures where organization_id=p_organization_id and project_id=p_project_id for update;
  if not found or capture.revision is distinct from p_capture_revision then raise exception 'La captura ha cambiado.' using errcode='40001'; end if;
  select bv.* into v from public.budget_versions bv join public.budgets b on b.id=bv.budget_id
    where bv.id=p_version_id and bv.organization_id=p_organization_id and b.project_id=p_project_id for update of bv;
  if not found or v.status<>'draft' then raise exception 'Elige un borrador abierto de este proyecto.' using errcode='22023'; end if;
  select * into result from public.room_capture_imports where version_id=v.id and capture_revision=capture.revision;
  if found then return to_jsonb(result); end if;
  if p_reviewed is distinct from true then raise exception 'Revisa la propuesta antes de incorporarla.' using errcode='22023'; end if;
  if p_expected_revision is distinct from v.draft_revision then raise exception 'El presupuesto ha cambiado.' using errcode='40001'; end if;
  if p_items is null or not private.valid_items(p_items) then raise exception 'Partidas no válidas.' using errcode='22023'; end if;
  select count(*) into work_count from jsonb_array_elements(capture.survey->'rooms') r, jsonb_array_elements(r->'selections') s where s->>'kind'='work';
  if work_count=0 or work_count<>jsonb_array_length(p_items) then raise exception 'Hay trabajos pendientes.' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(capture.survey->'rooms') r,jsonb_array_elements(r->'questions') q where q->>'required'='true' and btrim(coalesce(q->>'answer',''))='') then raise exception 'Hay preguntas pendientes.' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(p_items) loop
    select r,s->'intent' into room_data,selection from jsonb_array_elements(capture.survey->'rooms') r,jsonb_array_elements(r->'selections') s
      where s->>'kind'='work' and s->'intent'->>'id'=item->>'id';
    if not found then raise exception 'Partida ajena a esta captura.' using errcode='22023'; end if;
    if selection->'formula'->>'kind' is distinct from 'sum' or jsonb_typeof(selection->'formula'->'measurement_ids') is distinct from 'array' then raise exception 'Esta incorporación admite cantidades anotadas; usa el flujo de planos para la geometría.' using errcode='22023'; end if;
    if jsonb_array_length(selection->'formula'->'measurement_ids') not between 1 and 100
      or (select count(distinct value) from jsonb_array_elements(selection->'formula'->'measurement_ids'))<>jsonb_array_length(selection->'formula'->'measurement_ids') then raise exception 'Mediciones repetidas o vacías.' using errcode='22023'; end if;
    computed_quantity:=0;
    for measurement_id in select value from jsonb_array_elements(selection->'formula'->'measurement_ids') loop
      select m into measurement from jsonb_array_elements(room_data->'measurements') m where m->'id'=measurement_id;
      if not found or measurement->>'kind' is distinct from 'quantity' or measurement->>'unit' is distinct from item->>'unit'
        or jsonb_typeof(measurement->'value') is distinct from 'number' then raise exception 'Falta una cantidad compatible.' using errcode='22023'; end if;
      if (measurement->>'value')::numeric<=0 or (measurement->>'value')::numeric>1000000 then raise exception 'Cantidad fuera de límites.' using errcode='22023'; end if;
      select so into source from jsonb_array_elements(capture.survey->'sources') so where so->>'id'=measurement->>'source_id';
      if not found or not (room_data->'source_ids' ? (source->>'id')) then raise exception 'Medida de otra zona.' using errcode='22023'; end if;
      if not coalesce((measurement->>'method'='manual' and source->>'kind'='manual')
        or (measurement->>'method'='laser' and source->>'kind'='laser_measure')
        or (measurement->>'method'='reported' and source->>'kind'='voice')
        or (measurement->>'method'='metric_export' and source->>'kind' in ('lidar','laser_scan','cad'))
        or (measurement->>'method'='visual_estimate' and source->>'kind' in ('photo','panorama','video','manual','voice')),false) then raise exception 'La fuente no justifica el método de medición.' using errcode='22023'; end if;
      computed_quantity:=computed_quantity+(measurement->>'value')::numeric;
    end loop;
    if (item->>'quantity')::numeric is distinct from round(computed_quantity,3) then raise exception 'La cantidad no coincide con las medidas guardadas.' using errcode='22023'; end if;

    select * into article from public.articles where organization_id=p_organization_id and id=(selection->>'article_id')::uuid;
    if not found or (item->>'unit_price')::bigint is distinct from article.unit_price or (item->>'vat_rate')::numeric is distinct from article.vat_rate
      or item->>'unit' is distinct from article.unit or item->>'description' is distinct from article.name or item->>'chapter' is distinct from article.chapter then raise exception 'El catálogo ha cambiado; vuelve a calcular.' using errcode='40001'; end if;
    if coalesce((selection->>'adjustment_percent')::numeric,0)<>0 and length(btrim(coalesce(selection->>'adjustment_reason','')))=0 then raise exception 'Falta el motivo del ajuste.' using errcode='22023'; end if;
    if (item->>'adjustment_percent')::numeric is distinct from (selection->>'adjustment_percent')::numeric or item->>'inclusion' is distinct from selection->>'inclusion' then raise exception 'El ajuste no coincide con la captura.' using errcode='22023'; end if;
    select value into current_item from jsonb_array_elements(v.items) where value->>'id'=item->>'id';
    if found then
      select i into previous_item from public.room_capture_imports h,jsonb_array_elements(h.items) i where h.version_id=v.id and i->>'id'=item->>'id' order by h.capture_revision desc limit 1;
      if not found or previous_item is distinct from current_item then raise exception 'Una partida ya se ha editado en el presupuesto.' using errcode='40001'; end if;
    end if;
  end loop;
  select coalesce(jsonb_agg(i),'[]') into combined from jsonb_array_elements(v.items) i where not exists(select 1 from jsonb_array_elements(p_items) n where n->>'id'=i->>'id');
  combined:=combined||p_items;
  if not private.valid_items(combined) then raise exception 'El presupuesto supera sus límites.' using errcode='22023'; end if;
  perform public.execute_command(p_organization_id,jsonb_build_object('type','budget.save','version_id',v.id,'expected_revision',v.draft_revision,'items',combined,'notes',v.notes));
  insert into public.room_capture_imports(organization_id,project_id,version_id,capture_revision,survey,items,created_by_name)
    values(p_organization_id,p_project_id,v.id,capture.revision,capture.survey,p_items,member.display_name) returning * into result;
  return to_jsonb(result);
end $$;
revoke all on function public.apply_room_capture(uuid,uuid,integer,uuid,integer,jsonb,boolean) from public,anon;
grant execute on function public.apply_room_capture(uuid,uuid,integer,uuid,integer,jsonb,boolean) to authenticated;
