begin;

alter table public.shift_guides
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade,
  add column if not exists location_id uuid references public.locations(id) on delete cascade,
  add column if not exists ablauf_typ text not null default 'other',
  add column if not exists shift_hint text,
  add column if not exists updated_at timestamptz not null default now();

update public.shift_guides g set
  tenant_id=coalesce(g.tenant_id,d.tenant_id),
  location_id=coalesce(g.location_id,d.location_id),
  ablauf_typ=case when g.phase='opening' then 'opening' when g.phase='closing' then 'closing' else g.ablauf_typ end
from public.departments d where d.id=g.department_id and (g.tenant_id is null or g.location_id is null);

do $constraints$ begin
  if not exists(select 1 from pg_constraint where conname='shift_guides_ablauf_typ_check') then
    alter table public.shift_guides add constraint shift_guides_ablauf_typ_check check(ablauf_typ in ('opening','closing','cleaning','control','production','handover','hygiene_temperature','other'));
  end if;
end $constraints$;

create index if not exists shift_guides_scope_idx on public.shift_guides(tenant_id,location_id,aktiv,titel);
alter table public.shift_guides enable row level security;

-- Runtime snapshots stay on the canonical operational task. Existing tasks
-- remain valid; only guided executions carry these two optional JSON fields.
alter table public.operational_tasks
  add column if not exists procedure_content jsonb,
  add column if not exists procedure_results jsonb not null default '{}'::jsonb;

drop policy if exists shift_guides_read_scoped on public.shift_guides;
drop policy if exists shift_guides_manage_scoped on public.shift_guides;
create policy shift_guides_read_scoped on public.shift_guides for select to authenticated using (
  tenant_id=public.current_tenant_id() and public.can_access_operational_location(tenant_id,location_id)
);
create policy shift_guides_manage_scoped on public.shift_guides for all to authenticated using (
  tenant_id=public.current_tenant_id() and public.can_manage_operational_location(tenant_id,location_id)
) with check (
  tenant_id=public.current_tenant_id() and public.can_manage_operational_location(tenant_id,location_id)
);

-- Normalize only legacy category/step objects. Unknown fields are retained;
-- stable ids and editor defaults are added idempotently.
update public.shift_guides g set inhalt=jsonb_set(
  jsonb_set(coalesce(g.inhalt,'{}'::jsonb),'{schemaVersion}','1'::jsonb,true),
  '{categories}',
  coalesce((select jsonb_agg(
    jsonb_set(c.value,'{id}',to_jsonb(coalesce(nullif(c.value->>'id',''),'category-'||c.ordinality)),true)
    || jsonb_build_object('title',coalesce(c.value->>'title',c.value->>'name','Abschnitt '||c.ordinality),'steps',
      coalesce((select jsonb_agg(
        jsonb_build_object(
          'id',coalesce(nullif(s.value->>'id',''),'step-'||c.ordinality||'-'||s.ordinality),
          'title',coalesce(s.value->>'title',s.value->>'text',s.value->>'name','Schritt '||s.ordinality),
          'description',coalesce(s.value->>'description',s.value->>'hint',''),
          'required',coalesce(nullif(s.value->>'required','')::boolean,nullif(s.value->>'pflicht','')::boolean,true),
          'evidence',case coalesce(s.value->>'evidence',s.value->>'evidence_type','none') when 'foto' then 'photo' when 'messwert' then 'value' when 'unterschrift' then 'confirmation' else coalesce(s.value->>'evidence',s.value->>'evidence_type','none') end,
          'confirmationText',coalesce(s.value->>'confirmationText',''),'unit',coalesce(s.value->>'unit',''),
          'assigneeHint',coalesce(s.value->>'assigneeHint',s.value->>'role','')
        ) || (s.value - array['id','title','text','name','description','hint','required','pflicht','evidence','evidence_type','confirmationText','unit','assigneeHint','role'])
        order by s.ordinality
      ) from jsonb_array_elements(coalesce(c.value->'steps','[]'::jsonb)) with ordinality s(value,ordinality)),'[]'::jsonb)
    ) order by c.ordinality
  ) from jsonb_array_elements(coalesce(g.inhalt->'categories','[]'::jsonb)) with ordinality c(value,ordinality)),'[]'::jsonb),true
) where jsonb_typeof(coalesce(g.inhalt->'categories','null'::jsonb))='array' and coalesce(g.inhalt->>'schemaVersion','')<>'1';

commit;
