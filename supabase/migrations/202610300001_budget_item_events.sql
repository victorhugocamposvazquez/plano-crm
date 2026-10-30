-- Registro de ediciones reales desde su activación. No reconstruye fechas históricas.
create table public.budget_item_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  budget_id uuid not null,
  version_id uuid not null,
  item_id uuid not null,
  draft_revision integer not null,
  kind text not null check (kind in ('added','changed','removed')),
  fields text[] not null,
  before_item jsonb,
  after_item jsonb,
  occurred_at timestamptz not null default statement_timestamp(),
  actor_id uuid,
  actor_name text not null,
  foreign key (organization_id,budget_id,version_id)
    references public.budget_versions(organization_id,budget_id,id) on delete cascade
);
create index budget_item_events_latest on public.budget_item_events
  (organization_id,version_id,item_id,draft_revision desc,id);
alter table public.budget_item_events enable row level security;
revoke all on public.budget_item_events from public,anon,authenticated;
grant select on public.budget_item_events to authenticated;
create policy member_read on public.budget_item_events for select to authenticated
  using (private.member_role(organization_id) is not null);

create function private.record_budget_item_events() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  entry record;
  changed_fields text[];
  editor text;
  edited_at timestamptz := statement_timestamp();
begin
  select display_name into editor from public.organization_members
    where organization_id=new.organization_id and user_id=auth.uid();
  for entry in
    select coalesce(a.item->>'id',b.item->>'id')::uuid as item_id,
      a.item as before_item,b.item as after_item
    from jsonb_array_elements(old.items) a(item)
    full join jsonb_array_elements(new.items) b(item) on a.item->>'id'=b.item->>'id'
  loop
    select coalesce(array_agg(field order by ord),'{}'::text[]) into changed_fields
    from unnest(array['chapter','description','quantity','unit','unit_price','adjustment_percent','vat_rate','inclusion'])
      with ordinality as tracked(field,ord)
    where entry.before_item->field is distinct from entry.after_item->field;
    if cardinality(changed_fields)>0 then
      insert into public.budget_item_events
        (organization_id,budget_id,version_id,item_id,draft_revision,kind,fields,before_item,after_item,occurred_at,actor_id,actor_name)
      values (new.organization_id,new.budget_id,new.id,entry.item_id,new.draft_revision,
        case when entry.before_item is null then 'added' when entry.after_item is null then 'removed' else 'changed' end,
        changed_fields,entry.before_item,entry.after_item,edited_at,auth.uid(),coalesce(editor,'Proceso del sistema'));
    end if;
  end loop;
  return new;
end $$;
revoke all on function private.record_budget_item_events() from public,anon,authenticated;
create trigger record_budget_item_events after update of items on public.budget_versions
  for each row when (old.items is distinct from new.items)
  execute function private.record_budget_item_events();

-- Solo la última edición por partida en esa versión; la tabla conserva todos los guardados.
-- Invocador: respeta RLS. No incluye las instantáneas completas en la respuesta de lectura.
create function public.budget_item_change_dates(p_version_id uuid, p_draft_revision integer default 2147483647)
returns table (item_id uuid, version_id uuid, draft_revision integer, kind text, fields text[], occurred_at timestamptz, actor_name text)
language sql stable security invoker set search_path = '' as $$
  select distinct on (e.item_id) e.item_id,e.version_id,e.draft_revision,e.kind,e.fields,e.occurred_at,e.actor_name
  from public.budget_item_events e where e.version_id=p_version_id and e.draft_revision<=p_draft_revision
  order by e.item_id,e.draft_revision desc,e.occurred_at desc,e.id;
$$;
revoke all on function public.budget_item_change_dates(uuid,integer) from public,anon;
grant execute on function public.budget_item_change_dates(uuid,integer) to authenticated;
