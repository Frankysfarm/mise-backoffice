-- Verhaltenstest Listen-Builder-Kopplung (läuft nur im Dry-Run, wird nie deployt)
do $$
declare
  v_tenant uuid := gen_random_uuid(); v_loc uuid := gen_random_uuid();
  v_mgr uuid := gen_random_uuid(); v_mgr2 uuid := gen_random_uuid(); v_emp uuid := gen_random_uuid();
  v_role_guide uuid := gen_random_uuid(); v_direct_guide uuid := gen_random_uuid();
  v_n integer; v_task uuid; v_ctrl uuid;
begin
  insert into public.tenants(id,name,slug) values (v_tenant,'Testbetrieb LB','testbetrieb-lb');
  insert into public.locations(id,tenant_id,name) values (v_loc,v_tenant,'Teststandort LB');
  insert into public.employees(id,tenant_id,location_id,vorname,nachname,email,rolle,status) values
    (v_mgr,v_tenant,v_loc,'Frida','Filialleitung','frida@example.test','manager','aktiv'),
    (v_mgr2,v_tenant,v_loc,'Fred','Filialleitung','fred@example.test','manager','aktiv'),
    (v_emp,v_tenant,v_loc,'Milan','Mitarbeiter','milan@example.test','mitarbeiter','aktiv');

  -- Rollen-Liste (alle Filialleiter) mit Anleitungs-Medien im Schritt
  insert into public.shift_guides(id,tenant_id,location_id,titel,phase,aktiv,inhalt,assignment_kind,assigned_role)
    values (v_role_guide,v_tenant,v_loc,'Filialleiter-Tagescheck','midday',true,
      '{"schemaVersion":1,"categories":[{"id":"c1","title":"Check","steps":[{"id":"s1","title":"Kasse prüfen","required":true,"evidence":"photo","media":[{"kind":"image","path":"t/guides/g/a.jpg","caption":"So sieht es richtig aus"}]}]}]}'::jsonb,
      'rolle','manager');
  -- Mitarbeiter-Liste, direkt an Milan gekoppelt
  insert into public.shift_guides(id,tenant_id,location_id,titel,phase,aktiv,inhalt,assignment_kind)
    values (v_direct_guide,v_tenant,v_loc,'Milans Spezialliste','midday',true,'{"schemaVersion":1,"categories":[{"id":"c1","title":"A","steps":[{"id":"s1","title":"Tun"}]}]}'::jsonb,'mitarbeiter');
  insert into public.shift_guide_assignees(tenant_id,guide_id,employee_id) values (v_tenant,v_direct_guide,v_emp);

  -- Materialisierung: 2 Filialleiter + 1 Direktzuordnung, idempotent
  select public.materialize_direct_guide_tasks(now()) into v_n;
  if v_n <> 3 then raise exception 'FAIL direct materialize: %', v_n; end if;
  select public.materialize_direct_guide_tasks(now()) into v_n;
  if v_n <> 0 then raise exception 'FAIL direct materialize not idempotent: %', v_n; end if;
  select id into v_task from public.operational_tasks
    where source_type='shift_guide' and source_id like 'shift_guide:direkt:'||v_role_guide||':'||v_mgr||':%';
  if v_task is null then raise exception 'FAIL role task missing'; end if;
  if (select procedure_content->'categories'->0->'steps'->0->'media'->0->>'kind' from public.operational_tasks where id=v_task) <> 'image'
    then raise exception 'FAIL media snapshot missing'; end if;
  select count(*) into v_n from public.operational_tasks
    where source_type='shift_guide' and source_id like 'shift_guide:direkt:'||v_direct_guide||':'||v_emp||':%' and status<>'storniert';
  if v_n <> 1 then raise exception 'FAIL direct assignee task: %', v_n; end if;

  -- Schicht-Materialisierung darf Direktaufgaben nicht stornieren
  perform public.materialize_shift_guide_tasks(now());
  select count(*) into v_n from public.operational_tasks
    where source_id like 'shift_guide:direkt:%' and tenant_id=v_tenant and status='storniert';
  if v_n <> 0 then raise exception 'FAIL shift reconcile cancelled direct tasks: %', v_n; end if;

  -- Überfällig ⇒ Kontrolle (generische Eskalation greift auch für Direktlisten)
  perform public.escalate_overdue_shift_guides(now()+interval '2 days');
  select id into v_ctrl from public.operational_tasks where source_type='shift_guide_control' and source_id='control:'||v_task;
  if v_ctrl is null then raise exception 'FAIL direct escalation control missing'; end if;

  -- Zuordnung entfernt ⇒ Aufgabe wird storniert
  delete from public.shift_guide_assignees where guide_id=v_direct_guide and employee_id=v_emp;
  perform public.materialize_direct_guide_tasks(now());
  select count(*) into v_n from public.operational_tasks
    where source_id like 'shift_guide:direkt:'||v_direct_guide||':%' and status<>'storniert';
  if v_n <> 0 then raise exception 'FAIL assignee removal reconcile: %', v_n; end if;

  -- Liste deaktiviert ⇒ Rollen-Aufgaben werden storniert
  update public.shift_guides set aktiv=false where id=v_role_guide;
  perform public.materialize_direct_guide_tasks(now());
  select count(*) into v_n from public.operational_tasks
    where source_id like 'shift_guide:direkt:'||v_role_guide||':%' and status<>'storniert';
  if v_n <> 0 then raise exception 'FAIL deactivate reconcile: %', v_n; end if;

  raise notice 'Listen-Builder-Verhaltenstest OK';
end $$;
