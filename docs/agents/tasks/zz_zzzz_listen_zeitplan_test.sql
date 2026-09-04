-- Verhaltenstest Listen-Zeitplan + Bereichs-Zuweisung (nur Dry-Run, wird nie deployt)
do $$
declare
  v_tenant uuid := gen_random_uuid(); v_loc uuid := gen_random_uuid();
  v_dep uuid := gen_random_uuid(); v_mgr uuid := gen_random_uuid();
  v_koch uuid := gen_random_uuid(); v_koch2 uuid := gen_random_uuid(); v_bar uuid := gen_random_uuid();
  v_today_guide uuid := gen_random_uuid(); v_offday_guide uuid := gen_random_uuid();
  v_dep_guide uuid := gen_random_uuid();
  v_dow smallint; v_offday smallint; v_n integer; v_due timestamptz;
begin
  v_dow := extract(isodow from (now() at time zone 'Europe/Berlin'))::smallint;
  v_offday := (v_dow % 7) + 1;
  insert into public.tenants(id,name,slug) values (v_tenant,'Testbetrieb ZP','testbetrieb-zp');
  insert into public.locations(id,tenant_id,name) values (v_loc,v_tenant,'Teststandort ZP');
  insert into public.departments(id,tenant_id,location_id,name) values (v_dep,v_tenant,v_loc,'Küche ZP');
  insert into public.employees(id,tenant_id,location_id,vorname,nachname,email,rolle,status) values
    (v_mgr,v_tenant,v_loc,'Mia','Leitung','mia-zp@example.test','manager','aktiv'),
    (v_bar,v_tenant,v_loc,'Ben','Bar','ben-zp@example.test','mitarbeiter','aktiv');
  insert into public.employees(id,tenant_id,location_id,department_id,vorname,nachname,email,rolle,status) values
    (v_koch,v_tenant,v_loc,v_dep,'Kim','Koch','kim-zp@example.test','mitarbeiter','aktiv'),
    (v_koch2,v_tenant,v_loc,v_dep,'Kai','Koch','kai-zp@example.test','mitarbeiter','aktiv');

  -- Heute geplant, Fälligkeit 11:30
  insert into public.shift_guides(id,tenant_id,location_id,titel,phase,aktiv,inhalt,assignment_kind,assigned_role,schedule_weekdays,due_time)
    values (v_today_guide,v_tenant,v_loc,'Leitung Vormittagscheck','midday',true,'{"schemaVersion":1,"categories":[{"id":"c","title":"A","steps":[{"id":"s","title":"T"}]}]}'::jsonb,
      'rolle','manager',array[v_dow]::smallint[],time '11:30');
  -- Nur an einem anderen Wochentag geplant
  insert into public.shift_guides(id,tenant_id,location_id,titel,phase,aktiv,inhalt,assignment_kind,assigned_role,schedule_weekdays)
    values (v_offday_guide,v_tenant,v_loc,'Leitung Spezialtag','midday',true,'{"schemaVersion":1,"categories":[{"id":"c","title":"A","steps":[{"id":"s","title":"T"}]}]}'::jsonb,
      'rolle','manager',array[v_offday]::smallint[]);
  -- Bereichs-Liste (Gruppe Küche), täglich, Standard-Uhrzeit
  insert into public.shift_guides(id,tenant_id,location_id,titel,phase,aktiv,inhalt,assignment_kind,assigned_department_id)
    values (v_dep_guide,v_tenant,v_loc,'Küchen-Tagescheck','midday',true,'{"schemaVersion":1,"categories":[{"id":"c","title":"A","steps":[{"id":"s","title":"T"}]}]}'::jsonb,
      'bereich',v_dep);

  select public.materialize_direct_guide_tasks(now()) into v_n;
  -- 1× Leitung heute + 2× Küche; Spezialtag und Bar-Mitarbeiter bekommen nichts
  if v_n <> 3 then raise exception 'FAIL zeitplan materialize: %', v_n; end if;
  select count(*) into v_n from public.operational_tasks where source_id like 'shift_guide:direkt:'||v_offday_guide||':%';
  if v_n <> 0 then raise exception 'FAIL offday guide created tasks: %', v_n; end if;
  select count(*) into v_n from public.operational_tasks where source_id like 'shift_guide:direkt:'||v_dep_guide||':%' and status<>'storniert';
  if v_n <> 2 then raise exception 'FAIL bereich tasks: %', v_n; end if;
  select count(*) into v_n from public.operational_tasks
    where source_id like 'shift_guide:direkt:'||v_dep_guide||':'||v_bar||':%';
  if v_n <> 0 then raise exception 'FAIL bar employee got kitchen task'; end if;
  select due_at into v_due from public.operational_tasks where source_id like 'shift_guide:direkt:'||v_today_guide||':'||v_mgr||':%';
  if to_char(v_due at time zone 'Europe/Berlin','HH24:MI') <> '11:30' then raise exception 'FAIL due_time: %', v_due; end if;
  select public.materialize_direct_guide_tasks(now()) into v_n;
  if v_n <> 0 then raise exception 'FAIL zeitplan not idempotent: %', v_n; end if;

  -- Bereich gewechselt ⇒ Aufgabe wird beim nächsten Lauf storniert
  update public.employees set department_id = null where id = v_koch2;
  perform public.materialize_direct_guide_tasks(now());
  select count(*) into v_n from public.operational_tasks
    where source_id like 'shift_guide:direkt:'||v_dep_guide||':'||v_koch2||':%' and status<>'storniert';
  if v_n <> 0 then raise exception 'FAIL bereich reconcile: %', v_n; end if;

  raise notice 'Listen-Zeitplan-Verhaltenstest OK';
end $$;
