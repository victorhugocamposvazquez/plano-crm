-- Preparación del flujo PDF: no certifica mediciones ni modifica un presupuesto.
create table public.plan_captures (
  organization_id uuid not null, project_id uuid primary key,
  revision integer not null check(revision>0), draft jsonb not null check(jsonb_typeof(draft)='object' and octet_length(draft::text)<=2097152),
  updated_at timestamptz not null default statement_timestamp(), updated_by_name text not null,
  foreign key(organization_id,project_id) references public.projects(organization_id,id)
);
create table public.plan_capture_revisions (
  organization_id uuid not null, project_id uuid not null, revision integer not null,
  draft jsonb not null, created_at timestamptz not null default statement_timestamp(), created_by_name text not null,
  primary key(project_id,revision),
  foreign key(organization_id,project_id) references public.projects(organization_id,id)
);
alter table public.plan_captures enable row level security;
alter table public.plan_capture_revisions enable row level security;
revoke all on public.plan_captures,public.plan_capture_revisions from public,anon,authenticated;
grant select on public.plan_captures,public.plan_capture_revisions to authenticated;
create policy member_read on public.plan_captures for select to authenticated using(private.member_role(organization_id) is not null);
create policy member_read on public.plan_capture_revisions for select to authenticated using(private.member_role(organization_id) is not null);

create function public.save_plan_capture(p_organization_id uuid,p_project_id uuid,p_expected_revision integer,p_draft jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare member public.organization_members; result public.plan_captures; plan jsonb;
begin
  select * into member from public.organization_members where organization_id=p_organization_id and user_id=auth.uid();
  if not found or member.role not in ('admin','office','manager') then raise exception 'No tienes permiso para esta acción.' using errcode='42501'; end if;
  perform id from public.organizations where id=p_organization_id for update;
  if not exists(select 1 from public.projects where id=p_project_id and organization_id=p_organization_id) then raise exception 'Proyecto no encontrado.' using errcode='P0002'; end if;
  if p_expected_revision is null or p_expected_revision<0 or p_expected_revision>=2147483647
    or p_draft is null or jsonb_typeof(p_draft)<>'object' or octet_length(p_draft::text)>2097152
    or p_draft->>'version' is distinct from '2' or (p_draft->>'projectId')::uuid is distinct from p_project_id
    or jsonb_typeof(p_draft->'planos') is distinct from 'array' then raise exception 'Preparación no válida.' using errcode='22023'; end if;
  if jsonb_array_length(p_draft->'planos')>20 then raise exception 'Demasiados planos.' using errcode='22023'; end if;
  if p_draft->>'budgetId' is not null and not exists(select 1 from public.budgets where id=(p_draft->>'budgetId')::uuid and organization_id=p_organization_id and project_id=p_project_id) then raise exception 'Presupuesto de otro proyecto.' using errcode='23503'; end if;
  for plan in select value from jsonb_array_elements(p_draft->'planos') loop
    if not exists(select 1 from public.documents where id=(plan->>'documentId')::uuid and organization_id=p_organization_id and project_id=p_project_id and mime_type='application/pdf') then raise exception 'Falta el PDF original de este proyecto.' using errcode='23503'; end if;
  end loop;
  select * into result from public.plan_captures where project_id=p_project_id for update;
  if result.revision=p_expected_revision+1 and result.draft=p_draft then return to_jsonb(result); end if;
  if coalesce(result.revision,0)<>p_expected_revision then raise exception 'Otra persona ha actualizado la preparación.' using errcode='40001'; end if;
  insert into public.plan_captures(organization_id,project_id,revision,draft,updated_by_name)
    values(p_organization_id,p_project_id,p_expected_revision+1,p_draft,member.display_name)
    on conflict(project_id) do update set revision=excluded.revision,draft=excluded.draft,updated_by_name=excluded.updated_by_name,updated_at=statement_timestamp()
    returning * into result;
  insert into public.plan_capture_revisions(organization_id,project_id,revision,draft,created_at,created_by_name)
    values(result.organization_id,result.project_id,result.revision,result.draft,result.updated_at,result.updated_by_name);
  return to_jsonb(result);
end $$;
revoke all on function public.save_plan_capture(uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.save_plan_capture(uuid,uuid,integer,jsonb) to authenticated;
