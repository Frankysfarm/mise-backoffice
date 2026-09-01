-- Pflichtkette für die Mitarbeiter-App (Owner-Auftrag 01.09.2026):
--  1. Schicht ⇒ passende Schichtleitfäden werden automatisch Pflichtaufgaben des Mitarbeiters.
--  2. Nicht erledigt ⇒ Pflichtkontrolle beim Filialleiter (Hauptverantwortung / Standort-Manager).
--  3. Neu ⇒ Pflichtschulungen automatisch zuweisen; Onboarding gilt als abgeschlossen, wenn alle bestanden sind.
--  4. Jede In-App-Benachrichtigung wird zur E-Mail (email_outbox, Betriebs-Branding).
-- Idempotent: alle Objekte mit create or replace / drop if exists.

-- ---------------------------------------------------------------------------
-- 4. Benachrichtigung ⇒ E-Mail (universelle Brücke)
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_notification_email()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_emp record;
begin
  select e.id, e.tenant_id, e.email, e.vorname into v_emp from public.employees e where e.id = new.employee_id;
  if v_emp.id is null or v_emp.tenant_id is null or v_emp.email is null then return new; end if;
  -- Platzhalter- und Kiosk-Adressen bekommen keine Mails
  if v_emp.email ilike '%@mise.local' or v_emp.email ilike '%@kiosk.%' or v_emp.email ilike 'pending+%' then return new; end if;
  -- Ereignisse mit eigener, ausführlicher Mail (Dienstplan) nicht doppelt schicken
  if new.titel in ('Dienstplan veröffentlicht', 'Verfügbarkeit eintragen') then return new; end if;
  -- Dubletten-Schutz: gleiche Nachricht an dieselbe Person im selben Betrieb innerhalb von 12 Stunden nur einmal
  if exists (
    select 1 from public.email_outbox o
    where o.tenant_id = v_emp.tenant_id and o.to_email = v_emp.email and o.template = 'employee_notification'
      and o.subject = new.titel and coalesce(o.template_data->>'nachricht','') = coalesce(new.nachricht,'')
      and o.created_at > now() - interval '12 hours'
  ) then return new; end if;
  -- Schutz vor Dauerfeuer/Missbrauch: höchstens 20 System-Mails pro Person und Stunde
  if (select count(*) from public.email_outbox o where o.tenant_id = v_emp.tenant_id and o.to_email = v_emp.email and o.template = 'employee_notification' and o.created_at > now() - interval '1 hour') >= 20 then
    return new;
  end if;
  insert into public.email_outbox(tenant_id, to_email, subject, html, template, template_data)
  values (
    v_emp.tenant_id, v_emp.email, new.titel, '', 'employee_notification',
    jsonb_build_object(
      'employee_id', v_emp.id, 'vorname', coalesce(v_emp.vorname, ''),
      'titel', new.titel, 'nachricht', coalesce(new.nachricht, ''), 'link', coalesce(new.link, '/mitarbeiter'),
      'typ', new.typ::text, 'notification_id', new.id
    )
  );
  return new;
end $$;

drop trigger if exists notifications_enqueue_email on public.notifications;
create trigger notifications_enqueue_email after insert on public.notifications
  for each row execute function public.enqueue_notification_email();

-- ---------------------------------------------------------------------------
-- Aufgabe zugewiesen ⇒ Benachrichtigung (Checkliste, Kontrolle, normale Aufgabe)
-- ---------------------------------------------------------------------------
create or replace function public.notify_task_assigned()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_titel text; v_text text; v_link text; v_typ public.notification_type := 'info';
begin
  if new.assigned_to is null or new.status not in ('offen','angenommen') then return new; end if;
  if new.source_type = 'shift_guide_execution' then return new; end if; -- vom Mitarbeiter selbst gestartet
  -- Routine-Serien (Regeln, Schichtvorlagen) erscheinen in der App, werden aber nicht einzeln gemailt (14-Tage-Vorlauf)
  if new.source_type in ('shift_template', 'recurring_template') then return new; end if;
  -- Nur zeitnahe Aufgaben (Fälligkeit innerhalb 36 h) lösen eine Mail aus
  if new.due_at is not null and new.due_at > now() + interval '36 hours' then return new; end if;
  -- Kollegen dürfen sich nicht gegenseitig Benachrichtigungen erzeugen: nur Leitung oder Selbstzuweisung
  if new.created_by is not null and new.created_by <> new.assigned_to
     and not exists (select 1 from public.employees c where c.id = new.created_by and c.rolle::text in ('manager','backoffice','admin','teamleiter')) then
    return new;
  end if;
  if new.source_type = 'shift_guide' then
    v_titel := 'Pflicht-Checkliste: ' || new.title;
    v_text := 'Fällig bis ' || to_char(new.due_at at time zone 'Europe/Berlin', 'DD.MM. HH24:MI') || ' Uhr – bitte in deiner Schicht durchgehen.';
    v_link := '/mitarbeiter#pflicht';
  elsif new.source_type = 'shift_guide_control' then
    v_titel := 'Pflichtkontrolle';
    v_text := new.title;
    v_link := '/mitarbeiter#meine-aufgaben';
    v_typ := 'warnung';
  else
    v_titel := 'Neue Aufgabe';
    v_text := new.title || case when new.due_at is not null then ' – fällig ' || to_char(new.due_at at time zone 'Europe/Berlin', 'DD.MM. HH24:MI') else '' end;
    v_link := '/mitarbeiter#meine-aufgaben';
  end if;
  -- Serien (z. B. tägliche Regeln) nicht als Dauerfeuer melden
  if exists (select 1 from public.notifications n where n.employee_id = new.assigned_to and n.titel = v_titel and n.nachricht = v_text and n.created_at > now() - interval '10 minutes') then
    return new;
  end if;
  insert into public.notifications(employee_id, typ, titel, nachricht, link) values (new.assigned_to, v_typ, v_titel, v_text, v_link);
  return new;
end $$;

drop trigger if exists operational_tasks_notify_assigned on public.operational_tasks;
create trigger operational_tasks_notify_assigned after insert on public.operational_tasks
  for each row execute function public.notify_task_assigned();

-- ---------------------------------------------------------------------------
-- Schulung manuell zugewiesen ⇒ Benachrichtigung
-- ---------------------------------------------------------------------------
create or replace function public.notify_training_assigned()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_titel text;
begin
  if coalesce(new.assignment_source, '') <> 'manual' then return new; end if;
  select m.titel into v_titel from public.training_modules m where m.id = new.module_id;
  insert into public.notifications(employee_id, typ, titel, nachricht, link)
  values (new.employee_id, 'info', 'Neue Schulung: ' || coalesce(v_titel, 'Schulung'),
    case when new.due_at is not null then 'Bitte bis ' || to_char(new.due_at at time zone 'Europe/Berlin', 'DD.MM.YYYY') || ' abschließen.' else 'Bitte in deiner Mitarbeiter-App abschließen.' end,
    '/mitarbeiter/schulungen');
  return new;
end $$;

drop trigger if exists training_progress_notify_assigned on public.training_progress;
create trigger training_progress_notify_assigned after insert on public.training_progress
  for each row execute function public.notify_training_assigned();

-- ---------------------------------------------------------------------------
-- Übergabe erstellt ⇒ Benachrichtigung an die Folgeschicht
-- ---------------------------------------------------------------------------
create or replace function public.notify_handover_created()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_from text;
begin
  if new.to_employee_id is null then return new; end if;
  select e.vorname || ' ' || coalesce(e.nachname, '') into v_from from public.employees e where e.id = new.from_employee_id;
  insert into public.notifications(employee_id, typ, titel, nachricht, link)
  values (new.to_employee_id, 'info', 'Übergabe von ' || coalesce(trim(v_from), 'deiner Vorschicht'),
    'Bitte lesen und bestätigen: ' || left(coalesce(new.important_notes, new.incidents, new.note, 'Übergabe'), 160), '/mitarbeiter#meine-aufgaben');
  return new;
end $$;

drop trigger if exists responsibility_handovers_notify on public.responsibility_handovers;
create trigger responsibility_handovers_notify after insert on public.responsibility_handovers
  for each row execute function public.notify_handover_created();

-- ---------------------------------------------------------------------------
-- 3. Onboarding: Pflichtschulungen automatisch zuweisen, Abschluss erkennen
-- ---------------------------------------------------------------------------
create or replace function public.assign_onboarding_trainings_internal(p_employee_id uuid)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v_employee record; v_count integer := 0;
begin
  select * into v_employee from public.employees where id = p_employee_id;
  if v_employee.id is null or v_employee.tenant_id is null then return 0; end if;
  if v_employee.status::text not in ('aktiv','in_training','in_probe') then return 0; end if;
  with inserted as (
    insert into public.training_progress(tenant_id, employee_id, module_id, fortschritt_prozent, abgeschlossen, status, assigned_at, due_at, assignment_source)
    select v_employee.tenant_id, v_employee.id, module.id, 0, false, 'offen', now(),
      case when module.deadline_days is not null then now() + make_interval(days => module.deadline_days) else null end, 'onboarding'
    from public.training_modules module
    where module.tenant_id = v_employee.tenant_id and module.aktiv and module.pflicht
      and (module.location_id is null or module.location_id = v_employee.location_id)
      and (not exists (select 1 from public.training_module_targets t where t.module_id = module.id and t.target_type = 'location')
           or exists (select 1 from public.training_module_targets t where t.module_id = module.id and t.target_type = 'location' and t.location_id = v_employee.location_id))
      and (not exists (select 1 from public.training_module_targets t where t.module_id = module.id and t.target_type = 'department')
           or exists (select 1 from public.training_module_targets t where t.module_id = module.id and t.target_type = 'department' and t.department_id = v_employee.department_id))
      and (not exists (select 1 from public.training_module_targets t where t.module_id = module.id and t.target_type = 'position')
           or exists (select 1 from public.training_module_targets t where t.module_id = module.id and t.target_type = 'position' and lower(t.position_type) = lower(coalesce(v_employee.position_typ, ''))))
      and (module.position_typ is null or lower(module.position_typ) = lower(coalesce(v_employee.position_typ, '')))
    on conflict (employee_id, module_id) do nothing
    returning 1
  ) select count(*) into v_count from inserted;
  if v_count > 0 then
    insert into public.notifications(employee_id, typ, titel, nachricht, link)
    values (v_employee.id, 'info', 'Deine Schulungen sind bereit',
      v_count || ' Pflichtschulung' || case when v_count = 1 then '' else 'en' end || ' warten auf dich. Erst wenn alle bestanden sind, wird deine Mitarbeiter-App vollständig freigeschaltet.',
      '/mitarbeiter/schulungen');
  end if;
  return v_count;
end $$;

create or replace function public.employees_assign_onboarding_trigger()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op = 'UPDATE'
     and old.status is not distinct from new.status
     and old.location_id is not distinct from new.location_id
     and old.department_id is not distinct from new.department_id
     and old.position_typ is not distinct from new.position_typ then
    return new;
  end if;
  perform public.assign_onboarding_trainings_internal(new.id);
  return new;
end $$;

drop trigger if exists employees_assign_onboarding on public.employees;
create trigger employees_assign_onboarding after insert or update of status, location_id, department_id, position_typ on public.employees
  for each row execute function public.employees_assign_onboarding_trigger();

-- Letzte Pflichtschulung bestanden ⇒ Onboarding abgeschlossen + Willkommen
create or replace function public.training_progress_onboarding_complete()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_open integer; v_done_at timestamptz;
begin
  if coalesce(new.status, '') <> 'bestanden' or old.status is not distinct from new.status then return new; end if;
  select e.onboarding_completed_at into v_done_at from public.employees e where e.id = new.employee_id;
  if v_done_at is not null then return new; end if;
  select count(*) into v_open
  from public.training_progress p join public.training_modules m on m.id = p.module_id
  where p.employee_id = new.employee_id and m.pflicht and m.aktiv
    and coalesce(p.status, 'offen') <> 'bestanden' and not coalesce(p.abgeschlossen, false);
  if v_open = 0 then
    update public.employees set onboarding_completed_at = now(), updated_at = now() where id = new.employee_id;
    insert into public.notifications(employee_id, typ, titel, nachricht, link)
    values (new.employee_id, 'erfolg', 'Willkommen im Team – alle Schulungen bestanden',
      'Deine Mitarbeiter-App ist jetzt vollständig freigeschaltet: Schichten, Aufgaben, Übergaben und Checklisten.', '/mitarbeiter');
  end if;
  return new;
end $$;

drop trigger if exists training_progress_onboarding_complete on public.training_progress;
create trigger training_progress_onboarding_complete after update of status on public.training_progress
  for each row execute function public.training_progress_onboarding_complete();

-- ---------------------------------------------------------------------------
-- 1. Schicht ⇒ Schichtleitfäden als Pflichtaufgaben materialisieren
-- ---------------------------------------------------------------------------
create or replace function public.resolve_shift_guide_controller(p_tenant_id uuid, p_location_id uuid, p_department_id uuid, p_exclude_employee_id uuid, p_at timestamptz default now())
returns uuid language sql stable security definer set search_path=public,pg_temp as $$
  -- Nur Personen am selben Standort (Scope-Trigger verlangt das), zuerst gültige Hauptverantwortung (inkl. Wochentag), dann Standort-Leitung.
  select coalesce(
    (select a.employee_id from public.department_responsibility_assignments a
      join public.employees e on e.id = a.employee_id
      where a.tenant_id = p_tenant_id and a.location_id = p_location_id and a.department_id = p_department_id
        and a.responsibility_role = 'hauptverantwortung' and a.aktiv
        and a.valid_from <= (p_at at time zone 'Europe/Berlin')::date and (a.valid_until is null or a.valid_until >= (p_at at time zone 'Europe/Berlin')::date)
        and (a.weekday_scope is null or extract(isodow from (p_at at time zone 'Europe/Berlin'))::smallint = any(a.weekday_scope))
        and a.employee_id <> p_exclude_employee_id
        and e.location_id = p_location_id and e.status::text in ('aktiv','in_training','in_probe')
      order by a.valid_from desc limit 1),
    (select e.id from public.employees e
      where e.tenant_id = p_tenant_id and e.location_id = p_location_id and e.rolle::text in ('manager','backoffice','admin')
        and e.status::text in ('aktiv','in_training','in_probe') and e.id <> p_exclude_employee_id
        and coalesce(e.email, '') not ilike '%@mise.local' and coalesce(e.email, '') not ilike '%@kiosk.%'
      order by case e.rolle::text when 'manager' then 0 when 'backoffice' then 1 else 2 end, e.created_at limit 1)
  )
$$;

-- Ist ein gespeicherter Controller noch gültig (aktiv, am Standort)?
create or replace function public.is_valid_shift_guide_controller(p_employee_id uuid, p_tenant_id uuid, p_location_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists (select 1 from public.employees e where e.id = p_employee_id and e.tenant_id = p_tenant_id and e.location_id = p_location_id and e.status::text in ('aktiv','in_training','in_probe'))
$$;

create or replace function public.materialize_shift_guide_tasks(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v_shift record; v_guide record; v_due timestamptz; v_controller uuid; v_department uuid; v_kind text; v_count integer := 0;
begin
  -- Reconcile: Schicht abgesagt/gelöscht/umbesetzt oder Leitfaden deaktiviert ⇒ offene Pflichtaufgabe stornieren.
  -- source_id = 'shift_guide:<shift>:<guide>:<mitarbeiter>' (Unique-Index auf source_type/source_id erlaubt so eine Neuanlage nach Umbesetzung)
  begin
    update public.operational_tasks t
      set status = 'storniert', review_note = 'Automatisch storniert: Schicht geändert oder Ablauf deaktiviert.', updated_at = p_now
      where t.source_type = 'shift_guide' and t.status in ('offen','angenommen','in_arbeit')
        and t.source_id ~ '^shift_guide:[0-9a-f-]{36}:[0-9a-f-]{36}'
        and (
          not exists (select 1 from public.shifts s where s.id = t.shift_id)
          or exists (select 1 from public.shifts s where s.id = t.shift_id and (s.status::text in ('abgesagt','storniert') or s.employee_id is distinct from t.assigned_to))
          or not exists (select 1 from public.shift_guides g where g.id = split_part(t.source_id, ':', 3)::uuid and g.aktiv)
        );
  exception when others then
    raise notice 'materialize_shift_guide_tasks: reconcile übersprungen: %', sqlerrm;
  end;

  for v_shift in
    select s.* from public.shifts s
    where s.employee_id is not null and s.location_id is not null and s.tenant_id is not null
      and s.status::text not in ('abgesagt','abgeschlossen','storniert')
      and coalesce(s.typ::text, 'normal') <> 'probe'
      and s.start_zeit <= p_now + interval '3 hours'
      and s.end_zeit >= p_now - interval '1 hour'
      and s.start_zeit >= p_now - interval '16 hours'
  loop
    for v_guide in
      select g.* from public.shift_guides g
      where g.tenant_id = v_shift.tenant_id and g.location_id = v_shift.location_id and g.aktiv
        -- Position und Bereich müssen beide passen, sofern der Leitfaden sie vorgibt;
        -- bereichsgebundene Listen gelten nur für Schichten in genau diesem Bereich (Scope-Trigger: Aufgabe = Bereich der Schicht)
        and (g.position_typ is null or lower(g.position_typ) = lower(coalesce(v_shift.position, '')))
        and (g.department_id is null or g.department_id = v_shift.department_id)
    loop
      -- Fälligkeit: ablauf_typ nur, wenn er eine Tagesphase beschreibt; sonst die Phase des Leitfadens
      v_kind := case
        when v_guide.ablauf_typ in ('opening','closing') then v_guide.ablauf_typ
        when v_guide.phase::text in ('opening','closing','midday') then v_guide.phase::text
        else 'midday' end;
      v_due := case v_kind
        when 'opening' then v_shift.start_zeit + interval '60 minutes'
        when 'closing' then v_shift.end_zeit
        else v_shift.start_zeit + (v_shift.end_zeit - v_shift.start_zeit) / 2
      end;
      -- Bereits vorhanden (nicht storniert): nur Fälligkeit nachziehen, falls die Schicht verschoben wurde
      if exists (select 1 from public.operational_tasks t where t.source_type = 'shift_guide' and t.source_id = 'shift_guide:' || v_shift.id || ':' || v_guide.id || ':' || v_shift.employee_id and t.status <> 'storniert') then
        update public.operational_tasks t set due_at = v_due, updated_at = p_now
          where t.source_type = 'shift_guide' and t.source_id = 'shift_guide:' || v_shift.id || ':' || v_guide.id || ':' || v_shift.employee_id
            and t.status in ('offen','angenommen','in_arbeit') and t.due_at is distinct from v_due;
        continue;
      end if;
      -- Scope: Bereich der Schicht hat Vorrang; sonst Bereich des Leitfadens, aber nur am selben Standort
      v_department := case
        when v_shift.department_id is not null and exists (select 1 from public.departments d where d.id = v_shift.department_id and d.location_id = v_shift.location_id) then v_shift.department_id
        else null end;
      v_controller := public.resolve_shift_guide_controller(v_shift.tenant_id, v_shift.location_id, v_department, v_shift.employee_id, v_due);
      begin
        insert into public.operational_tasks(
          tenant_id, location_id, department_id, shift_id, title, description, status, priority,
          created_by, assigned_to, accountable_employee_id, controller_employee_id,
          due_at, evidence_requirements, source_type, source_id, procedure_content
        ) values (
          v_shift.tenant_id, v_shift.location_id, v_department, v_shift.id, v_guide.titel,
          'Pflicht-Checkliste für deine Schicht am ' || to_char(v_shift.start_zeit at time zone 'Europe/Berlin', 'DD.MM.') || ' (' ||
            case v_kind when 'opening' then 'Öffnung' when 'closing' then 'Schließung' else 'Schichtmitte' end || ').',
          'offen', 80,
          v_shift.employee_id, v_shift.employee_id, coalesce(v_controller, v_shift.employee_id), v_controller,
          v_due, '[]'::jsonb, 'shift_guide', 'shift_guide:' || v_shift.id || ':' || v_guide.id || ':' || v_shift.employee_id, v_guide.inhalt
        );
        v_count := v_count + 1;
      exception when others then
        -- Ein fehlerhafter Datensatz darf nicht den gesamten Lauf für alle Betriebe kippen
        raise notice 'materialize_shift_guide_tasks: shift % guide % übersprungen: %', v_shift.id, v_guide.id, sqlerrm;
      end;
    end loop;
  end loop;
  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Überfällige Checkliste ⇒ Pflichtkontrolle beim Filialleiter
-- ---------------------------------------------------------------------------
create or replace function public.escalate_overdue_shift_guides(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v_task record; v_controller uuid; v_name text; v_count integer := 0;
begin
  for v_task in
    select t.* from public.operational_tasks t
    where t.source_type = 'shift_guide' and t.status in ('offen','angenommen','in_arbeit')
      and t.due_at is not null and t.due_at < p_now
      and not exists (select 1 from public.operational_tasks c where c.source_type = 'shift_guide_control' and c.source_id = 'control:' || t.id)
    order by t.due_at
    limit 200
  loop
    v_controller := case
      when v_task.controller_employee_id is not null and public.is_valid_shift_guide_controller(v_task.controller_employee_id, v_task.tenant_id, v_task.location_id) then v_task.controller_employee_id
      else public.resolve_shift_guide_controller(v_task.tenant_id, v_task.location_id, v_task.department_id, v_task.assigned_to, p_now) end;
    -- Ohne Leitung am Standort: beim nächsten Lauf erneut versuchen (Kriterium bleibt „keine Kontrolle vorhanden“)
    if v_controller is null or v_controller = v_task.assigned_to then continue; end if;
    select e.vorname || ' ' || coalesce(e.nachname, '') into v_name from public.employees e where e.id = v_task.assigned_to;
    begin
      insert into public.operational_tasks(
        tenant_id, location_id, department_id, shift_id, parent_task_id, title, description, status, priority,
        created_by, assigned_to, accountable_employee_id, controller_employee_id, due_at, source_type, source_id
      ) values (
        v_task.tenant_id, v_task.location_id, v_task.department_id, v_task.shift_id, v_task.id,
        'Kontrolle: „' || v_task.title || '“ nicht erledigt – ' || coalesce(trim(v_name), 'Mitarbeiter') || ' (' || to_char(v_task.due_at at time zone 'Europe/Berlin', 'DD.MM. HH24:MI') || ')',
        'Die Pflicht-Checkliste wurde bis zur Fälligkeit nicht abgeschlossen. Bitte vor Ort prüfen, mit dem Mitarbeiter klären und diese Kontrolle abschließen.',
        'offen', 95,
        v_controller, v_controller, v_controller, null, p_now + interval '2 hours',
        'shift_guide_control', 'control:' || v_task.id
      );
      -- Erst nach erfolgreicher Kontrolle markieren (löst die bestehende Überfällig-Benachrichtigung an den Mitarbeiter aus)
      update public.operational_tasks set escalation_level = greatest(escalation_level, 1), last_escalated_at = p_now, escalation_owner_employee_id = v_controller, updated_at = p_now where id = v_task.id;
      v_count := v_count + 1;
    exception when others then
      raise notice 'escalate_overdue_shift_guides: task % übersprungen: %', v_task.id, sqlerrm;
    end;
  end loop;
  return v_count;
end $$;

-- Checkliste nach Eskalation doch noch erledigt ⇒ Kontrolle als Hinweis aktualisieren (bleibt zur Bestätigung offen)
create or replace function public.shift_guide_completed_update_control()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.source_type <> 'shift_guide' or new.status not in ('wartet_auf_pruefung','erledigt') or old.status in ('wartet_auf_pruefung','erledigt') then return new; end if;
  update public.operational_tasks c
    set description = c.description || E'\n\nNachtrag: Der Mitarbeiter hat die Checkliste inzwischen abgeschlossen (' || to_char(now() at time zone 'Europe/Berlin', 'DD.MM. HH24:MI') || '). Bitte nur noch bestätigen.',
        priority = 60, updated_at = now()
    where c.source_type = 'shift_guide_control' and c.source_id = 'control:' || new.id and c.status in ('offen','angenommen','in_arbeit');
  return new;
end $$;

drop trigger if exists operational_tasks_shift_guide_completed on public.operational_tasks;
create trigger operational_tasks_shift_guide_completed after update of status on public.operational_tasks
  for each row execute function public.shift_guide_completed_update_control();

revoke all on function public.materialize_shift_guide_tasks(timestamptz) from public, anon, authenticated;
revoke all on function public.escalate_overdue_shift_guides(timestamptz) from public, anon, authenticated;
revoke all on function public.assign_onboarding_trainings_internal(uuid) from public, anon, authenticated;
revoke all on function public.resolve_shift_guide_controller(uuid, uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.is_valid_shift_guide_controller(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.materialize_shift_guide_tasks(timestamptz) to service_role;
grant execute on function public.escalate_overdue_shift_guides(timestamptz) to service_role;
grant execute on function public.assign_onboarding_trainings_internal(uuid) to service_role;

-- Bestandsschutz: wer heute schon aktiv arbeitet, wird nicht rückwirkend in den Onboarding-Modus gesperrt.
-- Neue Mitarbeiter (ab jetzt) und alle mit Status in_training durchlaufen die Einarbeitung.
update public.employees set onboarding_completed_at = now(), updated_at = now()
  where onboarding_completed_at is null and status::text in ('aktiv','in_probe');

create index if not exists operational_tasks_source_lookup_idx on public.operational_tasks(source_type, source_id);
create index if not exists operational_tasks_shift_guide_open_idx on public.operational_tasks(due_at)
  where source_type = 'shift_guide' and status in ('offen','angenommen','in_arbeit');
create index if not exists email_outbox_dedupe_idx on public.email_outbox(to_email, template, created_at desc);
