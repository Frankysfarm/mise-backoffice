-- Paket „Filialleiter informiert immer" (Owner-Auftrag 02.09.2026):
--  1. Schulung bestanden ⇒ Nachricht an die Filialleitung (mit Ergebnis).
--  2. Onboarding komplett ⇒ „einsatzbereit"-Nachricht an die Filialleitung.
--  3. Pflichtschulung überfällig ⇒ Pflichtkontrolle bei der Filialleitung.
--  4. Neue Bestellliste (Fehlbestand) ⇒ Nachricht mit Fehlliste an die Filialleitung.
--  5. auto_reorder_drafts(): Artikel unter Mindestbestand ⇒ automatischer Bestellentwurf je Lieferant
--     (Artikel-Guard gegen Doppel-Entwürfe; läuft im Eskalations-Cron).
-- E-Mails entstehen automatisch über die bestehende Brücke notifications → email_outbox.
-- Idempotent: create or replace / drop if exists.

-- ---------------------------------------------------------------------------
-- Helfer: alle Leitungen eines Standorts benachrichtigen (dedupe macht die Brücke)
-- ---------------------------------------------------------------------------
create or replace function public.notify_location_leadership(p_tenant_id uuid, p_location_id uuid, p_exclude_employee_id uuid, p_typ public.notification_type, p_titel text, p_nachricht text, p_link text)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_count integer := 0;
begin
  for v_id in
    select e.id from public.employees e
    where e.tenant_id = p_tenant_id and e.location_id = p_location_id
      and e.rolle::text in ('manager','backoffice','admin')
      and e.status::text in ('aktiv','in_training','in_probe')
      and (p_exclude_employee_id is null or e.id <> p_exclude_employee_id)
      and coalesce(e.email, '') not ilike '%@mise.local' and coalesce(e.email, '') not ilike '%@kiosk.%'
  loop
    insert into public.notifications(employee_id, typ, titel, nachricht, link) values (v_id, p_typ, p_titel, p_nachricht, p_link);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Schulung bestanden ⇒ Filialleitung informieren
-- ---------------------------------------------------------------------------
create or replace function public.notify_training_passed()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_emp record; v_modul text;
begin
  if coalesce(new.status, '') <> 'bestanden' or old.status is not distinct from new.status then return new; end if;
  select e.* into v_emp from public.employees e where e.id = new.employee_id and e.tenant_id = new.tenant_id;
  if v_emp.id is null or v_emp.location_id is null then return new; end if;
  if v_emp.rolle::text in ('manager','backoffice','admin') then return new; end if; -- Leitung meldet sich nicht selbst
  select m.titel into v_modul from public.training_modules m where m.id = new.module_id and m.tenant_id = v_emp.tenant_id;
  perform public.notify_location_leadership(
    v_emp.tenant_id, v_emp.location_id, v_emp.id, 'erfolg',
    'Schulung bestanden: ' || coalesce(v_modul, 'Schulung'),
    v_emp.vorname || ' ' || coalesce(v_emp.nachname, '') || ' hat „' || coalesce(v_modul, 'die Schulung') || '“ bestanden' ||
      case when new.testergebnis is not null then ' (' || round(new.testergebnis) || ' %).' else '.' end,
    '/training');
  return new;
end $$;

drop trigger if exists training_progress_notify_passed on public.training_progress;
create trigger training_progress_notify_passed after update of status on public.training_progress
  for each row execute function public.notify_training_passed();

-- ---------------------------------------------------------------------------
-- 2. Onboarding komplett ⇒ „einsatzbereit" an die Filialleitung
-- ---------------------------------------------------------------------------
create or replace function public.notify_onboarding_ready()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.onboarding_completed_at is null or old.onboarding_completed_at is not distinct from new.onboarding_completed_at then return new; end if;
  if new.location_id is null or new.rolle::text in ('manager','backoffice','admin') then return new; end if;
  perform public.notify_location_leadership(
    new.tenant_id, new.location_id, new.id, 'erfolg',
    new.vorname || ' ist einsatzbereit',
    new.vorname || ' ' || coalesce(new.nachname, '') || ' hat alle Pflichtschulungen bestanden und kann jetzt eingeplant werden.',
    '/schedule');
  return new;
end $$;

drop trigger if exists employees_notify_onboarding_ready on public.employees;
create trigger employees_notify_onboarding_ready after update of onboarding_completed_at on public.employees
  for each row execute function public.notify_onboarding_ready();

-- ---------------------------------------------------------------------------
-- 3. Pflichtschulung überfällig ⇒ Pflichtkontrolle bei der Filialleitung
-- ---------------------------------------------------------------------------
create or replace function public.escalate_overdue_trainings(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v_row record; v_controller uuid; v_count integer := 0;
begin
  for v_row in
    select p.id as progress_id, p.due_at, e.id as employee_id, e.tenant_id, e.location_id, e.department_id,
           e.vorname, e.nachname, m.titel as modul
    from public.training_progress p
    join public.training_modules m on m.id = p.module_id and m.tenant_id = p.tenant_id
    join public.employees e on e.id = p.employee_id and e.tenant_id = p.tenant_id
    where p.status = 'ueberfaellig' and m.pflicht and m.aktiv
      and e.location_id is not null and e.status::text in ('aktiv','in_training','in_probe')
      and not exists (select 1 from public.operational_tasks c where c.source_type = 'training_overdue_control' and c.source_id = 'trctl:' || p.id)
      -- nur Fälle mit auflösbarer Leitung (gleiche Kriterien wie der Resolver), sonst verdrängen Altfälle das Limit dauerhaft
      and (
        exists (select 1 from public.employees mgr where mgr.tenant_id = e.tenant_id and mgr.location_id = e.location_id
                  and mgr.rolle::text in ('manager','backoffice','admin') and mgr.status::text in ('aktiv','in_training','in_probe') and mgr.id <> e.id
                  and coalesce(mgr.email, '') not ilike '%@mise.local' and coalesce(mgr.email, '') not ilike '%@kiosk.%')
        or exists (select 1 from public.department_responsibility_assignments a2
                     join public.employees he on he.id = a2.employee_id
                    where a2.tenant_id = e.tenant_id and a2.location_id = e.location_id and a2.department_id = e.department_id
                      and a2.responsibility_role = 'hauptverantwortung' and a2.aktiv and a2.employee_id <> e.id
                      and a2.valid_from <= (p_now at time zone 'Europe/Berlin')::date and (a2.valid_until is null or a2.valid_until >= (p_now at time zone 'Europe/Berlin')::date)
                      and (a2.weekday_scope is null or extract(isodow from (p_now at time zone 'Europe/Berlin'))::smallint = any(a2.weekday_scope))
                      and he.location_id = e.location_id and he.status::text in ('aktiv','in_training','in_probe'))
      )
    order by p.due_at
    limit 100
  loop
    v_controller := public.resolve_shift_guide_controller(v_row.tenant_id, v_row.location_id, v_row.department_id, v_row.employee_id, p_now);
    if v_controller is null or v_controller = v_row.employee_id then continue; end if;
    begin
      insert into public.operational_tasks(
        tenant_id, location_id, department_id, title, description, status, priority,
        created_by, assigned_to, accountable_employee_id, due_at, source_type, source_id
      ) values (
        v_row.tenant_id, v_row.location_id,
        case when v_row.department_id is not null and exists (select 1 from public.departments d where d.id = v_row.department_id and d.location_id = v_row.location_id) then v_row.department_id else null end,
        'Kontrolle: Schulung „' || v_row.modul || '“ überfällig – ' || v_row.vorname || ' ' || coalesce(v_row.nachname, ''),
        'Die Pflichtschulung wurde bis ' || to_char(v_row.due_at at time zone 'Europe/Berlin', 'DD.MM.YYYY') || ' nicht abgeschlossen. Bitte mit ' || v_row.vorname || ' klären und diese Kontrolle abschließen.',
        'offen', 90,
        v_controller, v_controller, v_controller, p_now + interval '24 hours',
        'training_overdue_control', 'trctl:' || v_row.progress_id
      );
      v_count := v_count + 1;
    exception when others then
      raise notice 'escalate_overdue_trainings: progress % übersprungen: %', v_row.progress_id, sqlerrm;
    end;
  end loop;
  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Neue Bestellliste ⇒ Fehlliste an die Filialleitung
-- ---------------------------------------------------------------------------
create or replace function public.notify_order_list_created()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_tenant uuid; v_summary text; v_n integer;
begin
  if new.location_id is null then return new; end if;
  select l.tenant_id into v_tenant from public.locations l where l.id = new.location_id;
  if v_tenant is null then return new; end if;
  select count(*), string_agg(elem->>'name' || ' × ' || coalesce(elem->>'menge', '?'), ', ')
    into v_n, v_summary
  from (select jsonb_array_elements(coalesce(new.positionen, '[]'::jsonb)) as elem limit 5) sub;
  perform public.notify_location_leadership(
    v_tenant, new.location_id, null, 'warnung',
    'Fehlbestand: Bestellvorschlag ' || coalesce('für ' || new.lieferant, 'erstellt'),
    coalesce(v_summary, 'Positionen in der Bestellliste') ||
      case when jsonb_array_length(coalesce(new.positionen, '[]'::jsonb)) > 5 then ' … (+' || (jsonb_array_length(new.positionen) - 5) || ' weitere)' else '' end ||
      ' – bitte prüfen und bestellen.',
    '/inventory');
  return new;
end $$;

drop trigger if exists order_lists_notify_leadership on public.order_lists;
create trigger order_lists_notify_leadership after insert on public.order_lists
  for each row execute function public.notify_order_list_created();

-- ---------------------------------------------------------------------------
-- 5. Automatische Bestellentwürfe: Artikel unter Mindestbestand ⇒ Entwurf je Lieferant
-- ---------------------------------------------------------------------------
create or replace function public.auto_reorder_drafts(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
-- Bewusst nur gezählte Artikel (letzte_inventur not null): der Cron soll auf Inventuren reagieren,
-- nie-gezählte Artikel meldet weiterhin nur der manuelle Bestellvorschlag-Button.
declare v_group record; v_positions jsonb; v_total numeric; v_creator uuid; v_supplier uuid; v_count integer := 0;
begin
  for v_group in
    select a.location_id, i.tenant_id, max(i.supplier_id::text)::uuid as supplier_id, max(coalesce(i.lieferant, '')) as lieferant, array_agg(i.id) as item_ids
    from public.inventory_items i
    join public.inventory_areas a on a.id = i.area_id
    join public.locations l on l.id = a.location_id and l.tenant_id = i.tenant_id -- Tenant-Konsistenz erzwingen
    where i.aktiv and i.min_bestand is not null and i.letzte_inventur is not null
      and i.letzte_inventur < i.min_bestand
      and not exists (
        select 1 from public.order_lists o
        where o.location_id = a.location_id
          and (o.status in ('entwurf','bestellt')
               -- Wareneingang ohne Einbuchen: 7 Tage Schonfrist, sonst entstünde täglich ein neuer Entwurf
               or (o.status = 'geliefert' and coalesce(o.geliefert_am, o.updated_at) > p_now - interval '7 days'))
          and o.positionen @> jsonb_build_array(jsonb_build_object('item_id', i.id::text))
      )
    -- Gruppenschlüssel wie in der Route: Lieferanten-ID hat Vorrang, sonst Freitext-Name
    group by a.location_id, i.tenant_id, coalesce(i.supplier_id::text, 'name:' || coalesce(i.lieferant, ''))
  loop
    begin
      v_creator := public.resolve_shift_guide_controller(v_group.tenant_id, v_group.location_id, null, '00000000-0000-0000-0000-000000000000'::uuid, p_now);
      if v_creator is null then continue; end if;
      -- Lieferant nur übernehmen, wenn er zum Betrieb gehört
      v_supplier := case when v_group.supplier_id is not null and exists (select 1 from public.suppliers sp where sp.id = v_group.supplier_id and sp.tenant_id = v_group.tenant_id) then v_group.supplier_id else null end;
      -- Mengenformel identisch zur bestehenden Route: nachbestell_menge, sonst soll-ist, sonst min, sonst 1
      select jsonb_agg(jsonb_build_object(
               'item_id', i.id::text, 'name', i.name, 'artikelnummer', i.artikelnummer,
               'menge', coalesce(i.nachbestell_menge, case when i.soll_bestand is not null then greatest(0, i.soll_bestand - coalesce(i.letzte_inventur, 0)) else coalesce(i.min_bestand, 1) end),
               'einheit', i.einheit, 'preis_pro_einheit', i.preis_pro_einheit,
               'lagerplatz', (select sh.name from public.inventory_shelves sh where sh.id = i.shelf_id and sh.area_id = i.area_id)
             )),
             coalesce(sum(coalesce(i.nachbestell_menge, case when i.soll_bestand is not null then greatest(0, i.soll_bestand - coalesce(i.letzte_inventur, 0)) else coalesce(i.min_bestand, 1) end) * coalesce(i.preis_pro_einheit, 0)), 0)
        into v_positions, v_total
      from public.inventory_items i where i.id = any(v_group.item_ids);
      if v_positions is null then continue; end if;
      insert into public.order_lists(location_id, supplier_id, lieferant, erstellt_von, positionen, gesamtbetrag, status, referenz)
      values (v_group.location_id, v_supplier, nullif(v_group.lieferant, ''), v_creator, v_positions, round(v_total * 100) / 100, 'entwurf', 'auto-inventur');
      v_count := v_count + 1;
    exception when others then
      raise notice 'auto_reorder_drafts: Gruppe % übersprungen: %', v_group.location_id, sqlerrm;
    end;
  end loop;
  return v_count;
end $$;

revoke all on function public.notify_location_leadership(uuid, uuid, uuid, public.notification_type, text, text, text) from public, anon, authenticated;
revoke all on function public.escalate_overdue_trainings(timestamptz) from public, anon, authenticated;
revoke all on function public.auto_reorder_drafts(timestamptz) from public, anon, authenticated;
grant execute on function public.escalate_overdue_trainings(timestamptz) to service_role;
grant execute on function public.auto_reorder_drafts(timestamptz) to service_role;

-- Performance im 3-Minuten-Cron
drop index if exists order_lists_open_positions_gin;
create index if not exists order_lists_open_positions_gin on public.order_lists using gin (positionen jsonb_path_ops) where status in ('entwurf','bestellt','geliefert');
create index if not exists inventory_items_under_min_idx on public.inventory_items(area_id) where aktiv and min_bestand is not null;
create index if not exists training_progress_overdue_idx on public.training_progress(due_at) where status = 'ueberfaellig';
