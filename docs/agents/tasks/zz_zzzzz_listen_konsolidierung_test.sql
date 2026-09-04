-- Verhaltenstest Listen-Konsolidierung (nur Dry-Run, wird nie deployt)
do $$
declare
  v_tenant uuid := gen_random_uuid(); v_loc uuid := gen_random_uuid();
  v_tpl uuid := gen_random_uuid(); v_zone uuid := gen_random_uuid();
  v_task1 uuid := gen_random_uuid(); v_task2 uuid := gen_random_uuid();
  v_guide record; v_n integer;
begin
  insert into public.tenants(id,name,slug) values (v_tenant,'Testbetrieb KONS','testbetrieb-kons');
  insert into public.locations(id,tenant_id,name) values (v_loc,v_tenant,'Teststandort KONS');
  insert into public.checkup_templates(id,tenant_id,location_id,titel,fragen,aktiv)
    values (v_tpl,v_tenant,v_loc,'Hygiene-Check KONS','[{"title":"Kühlhaus prüfen","evidence":"messwert","unit":"°C"}]'::jsonb,true);
  insert into public.cleaning_zones(id,location_id,name,aktiv) values (v_zone,v_loc,'Küche KONS',true);
  insert into public.cleaning_tasks(id,zone_id,titel,beschreibung,aktiv,requires_photo,sort_order)
    values (v_task1,v_zone,'Boden wischen','Mit Reiniger',true,true,1),
           (v_task2,v_zone,'Flächen desinfizieren',null,true,false,2);

  -- Migration erneut ausführen (Datei lief bereits; hier die Kern-Statements idempotent nachziehen)
  insert into public.shift_guides
    (tenant_id, location_id, department_id, titel, phase, ablauf_typ, position_typ, aktiv, inhalt, assignment_kind, migrated_from)
  select t.tenant_id, t.location_id, t.department_id, t.titel,
    case when t.phase::text in ('opening','closing','midday') then t.phase::text else 'midday' end::shift_guide_phase,
    'control', t.position_typ, false,
    case
      when jsonb_typeof(t.fragen) = 'object' and t.fragen ? 'categories' then t.fragen
      when jsonb_typeof(t.fragen) = 'array' then jsonb_build_object('schemaVersion',1,'categories',jsonb_build_array(jsonb_build_object('id','main','title','Prüfpunkte','steps',t.fragen)))
      else jsonb_build_object('schemaVersion',1,'categories',jsonb_build_array(jsonb_build_object('id','main','title','Prüfpunkte','steps','[]'::jsonb)))
    end,
    'schicht', 'checkup:' || t.id
  from public.checkup_templates t
  where t.aktiv and t.tenant_id is not null and t.location_id is not null
    and not exists (select 1 from public.shift_guides g where g.migrated_from = 'checkup:' || t.id);

  insert into public.shift_guides
    (tenant_id, location_id, titel, phase, ablauf_typ, aktiv, inhalt, assignment_kind, migrated_from)
  select l.tenant_id, z.location_id, 'Reinigung: ' || z.name, 'midday'::shift_guide_phase, 'cleaning', false,
    jsonb_build_object('schemaVersion',1,'categories',jsonb_build_array(jsonb_build_object('id','zone','title',z.name,'steps',(
      select coalesce(jsonb_agg(jsonb_build_object('id','task-'||ct.id,'title',ct.titel,'description',coalesce(ct.beschreibung,''),'required',true,'evidence',case when ct.requires_photo then 'photo' else 'none' end) order by ct.sort_order, ct.titel),'[]'::jsonb)
      from public.cleaning_tasks ct where ct.zone_id = z.id and ct.aktiv)))),
    'schicht', 'cleaning_zone:' || z.id
  from public.cleaning_zones z
  join public.locations l on l.id = z.location_id
  where z.aktiv and l.tenant_id is not null
    and exists (select 1 from public.cleaning_tasks ct where ct.zone_id = z.id and ct.aktiv)
    and not exists (select 1 from public.shift_guides g where g.migrated_from = 'cleaning_zone:' || z.id);

  select * into v_guide from public.shift_guides where migrated_from = 'checkup:' || v_tpl;
  if v_guide.id is null then raise exception 'FAIL checkup nicht migriert'; end if;
  if v_guide.aktiv then raise exception 'FAIL checkup-Liste darf nicht aktiv starten'; end if;
  if v_guide.inhalt->'categories'->0->'steps'->0->>'title' <> 'Kühlhaus prüfen' then raise exception 'FAIL checkup steps'; end if;

  select * into v_guide from public.shift_guides where migrated_from = 'cleaning_zone:' || v_zone;
  if v_guide.id is null then raise exception 'FAIL zone nicht migriert'; end if;
  if v_guide.ablauf_typ <> 'cleaning' or v_guide.aktiv then raise exception 'FAIL zone flags'; end if;
  if jsonb_array_length(v_guide.inhalt->'categories'->0->'steps') <> 2 then raise exception 'FAIL zone steps'; end if;
  if v_guide.inhalt->'categories'->0->'steps'->0->>'evidence' <> 'photo' then raise exception 'FAIL foto-pflicht'; end if;

  -- Idempotenz: dieselben Inserts erneut → keine Duplikate
  select count(*) into v_n from public.shift_guides where migrated_from like 'checkup:%' and tenant_id = v_tenant;
  if v_n <> 1 then raise exception 'FAIL checkup dupliziert: %', v_n; end if;

  -- Migrierte inaktive Listen erzeugen keine Aufgaben
  perform public.materialize_direct_guide_tasks(now());
  select count(*) into v_n from public.operational_tasks where tenant_id = v_tenant;
  if v_n <> 0 then raise exception 'FAIL inaktive Migration erzeugte Aufgaben: %', v_n; end if;

  raise notice 'Listen-Konsolidierungs-Verhaltenstest OK';
end $$;
