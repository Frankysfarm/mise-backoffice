begin;

alter table public.shift_guides
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade,
  add column if not exists location_id uuid references public.locations(id) on delete cascade,
  add column if not exists ablauf_typ text not null default 'other',
  add column if not exists shift_hint text,
  add column if not exists updated_at timestamptz not null default now();

update public.shift_guides g set
  tenant_id=coalesce(g.tenant_id,d.tenant_id),
  location_id=coalesce(g.location_id,d.location_id)
from public.departments d where d.id=g.department_id and (g.tenant_id is null or g.location_id is null);

-- The procedure type is independent of department scope. In particular,
-- site-wide legacy guides have no department but still retain their phase.
update public.shift_guides g set ablauf_typ=case
  when g.phase='opening' then 'opening'
  when g.phase='closing' then 'closing'
  else g.ablauf_typ
end
where g.ablauf_typ='other';

-- Legacy installations with exactly one company/site also contain site-wide
-- guides without a department. That unambiguous scope can be recovered safely.
update public.shift_guides g set tenant_id=t.id
from (select (array_agg(id))[1] id from public.tenants having count(*)=1) t
where g.tenant_id is null;

update public.shift_guides g set location_id=l.id
from (
  select tenant_id,(array_agg(id))[1] id from public.locations group by tenant_id having count(*)=1
) l
where g.location_id is null and g.tenant_id=l.tenant_id;

do $scope$ begin
  if exists(select 1 from public.shift_guides where tenant_id is null or location_id is null) then
    raise exception 'shift_guides contains legacy rows whose tenant/location scope is ambiguous';
  end if;
end $scope$;

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

-- Check-up templates historically had no company/site scope. Add it so the
-- guided server-side writer cannot address a template from another tenant.
alter table public.checkup_templates
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade,
  add column if not exists location_id uuid references public.locations(id) on delete cascade;

-- location_id already exists in the production baseline and is the strongest
-- scope source for site-wide templates without a department.
update public.checkup_templates t set tenant_id=l.tenant_id
from public.locations l
where l.id=t.location_id and t.tenant_id is null;

update public.checkup_templates t set
  tenant_id=coalesce(t.tenant_id,d.tenant_id),
  location_id=coalesce(t.location_id,d.location_id)
from public.departments d
where d.id=t.department_id and (t.tenant_id is null or t.location_id is null);

update public.checkup_templates t set tenant_id=one_tenant.id
from (select (array_agg(id))[1] id from public.tenants having count(*)=1) one_tenant
where t.tenant_id is null;

update public.checkup_templates t set location_id=one_location.id
from (
  select tenant_id,(array_agg(id))[1] id
  from public.locations group by tenant_id having count(*)=1
) one_location
where t.location_id is null and t.tenant_id=one_location.tenant_id;

do $checkup_scope$ begin
  if exists(select 1 from public.checkup_templates where tenant_id is null or location_id is null) then
    raise exception 'checkup_templates contains legacy rows whose tenant/location scope is ambiguous';
  end if;
end $checkup_scope$;

create index if not exists checkup_templates_scope_idx
  on public.checkup_templates(tenant_id,location_id,aktiv,titel);

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
          'title',coalesce(
            s.value->>'title',s.value->>'text',s.value->>'name',
            case when jsonb_typeof(s.value)='string' then s.value #>> '{}' end,
            'Schritt '||s.ordinality
          ),
          'description',coalesce(s.value->>'description',s.value->>'hint',''),
          'required',case
            when lower(coalesce(nullif(s.value->>'required',''),nullif(s.value->>'pflicht',''),'')) in ('true','t','1','ja','yes') then true
            when lower(coalesce(nullif(s.value->>'required',''),nullif(s.value->>'pflicht',''),'')) in ('false','f','0','nein','no') then false
            else true
          end,
          'evidence',case coalesce(s.value->>'evidence',s.value->>'evidence_type','none') when 'foto' then 'photo' when 'messwert' then 'value' when 'unterschrift' then 'confirmation' else coalesce(s.value->>'evidence',s.value->>'evidence_type','none') end,
          'confirmationText',coalesce(s.value->>'confirmationText',''),'unit',coalesce(s.value->>'unit',''),
          'assigneeHint',coalesce(s.value->>'assigneeHint',s.value->>'role','')
        ) || case when jsonb_typeof(s.value)='object'
          then s.value - array['id','title','text','name','description','hint','required','pflicht','evidence','evidence_type','confirmationText','unit','assigneeHint','role']
          else '{}'::jsonb end
        order by s.ordinality
      ) from jsonb_array_elements(coalesce(c.value->'steps','[]'::jsonb)) with ordinality s(value,ordinality)),'[]'::jsonb)
    ) order by c.ordinality
  ) from jsonb_array_elements(coalesce(g.inhalt->'categories','[]'::jsonb)) with ordinality c(value,ordinality)),'[]'::jsonb),true
) where jsonb_typeof(coalesce(g.inhalt->'categories','null'::jsonb))='array' and coalesce(g.inhalt->>'schemaVersion','')<>'1';

commit;
