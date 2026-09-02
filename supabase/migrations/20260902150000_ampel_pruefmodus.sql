-- Paket 2 „Ampel + Prüfmodus" (02.09.2026):
-- Prüfergebnis erreicht den Mitarbeiter sofort: freigegeben ⇒ Erfolg, beanstandet ⇒ Warnung mit Grund.
-- (E-Mail automatisch über die Brücke notifications → email_outbox.)

create or replace function public.notify_task_reviewed()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_reviewer text; v_link text;
begin
  if new.status not in ('erledigt','nicht_bestanden') or old.status is not distinct from new.status then return new; end if;
  if new.assigned_to is null then return new; end if;
  -- Nur echte Prüfungen melden: jemand anderes als der Mitarbeiter hat entschieden
  if coalesce(new.reviewed_by, new.assigned_to) = new.assigned_to then return new; end if;
  select vorname || ' ' || coalesce(nachname, '') into v_reviewer from public.employees where id = new.reviewed_by;
  -- Pflicht-Checklisten leben in der App unter #pflicht, alles andere unter #meine-aufgaben
  v_link := case when new.source_type = 'shift_guide' then '/mitarbeiter#pflicht' else '/mitarbeiter#meine-aufgaben' end;
  if new.status = 'erledigt' then
    insert into public.notifications(employee_id, typ, titel, nachricht, link)
    values (new.assigned_to, 'erfolg', 'Geprüft & freigegeben: ' || new.title,
      coalesce(trim(v_reviewer), 'Deine Leitung') || ' hat deine Arbeit geprüft und freigegeben.' ||
        case when nullif(trim(coalesce(new.review_note, '')), '') is not null then ' Anmerkung: ' || new.review_note else '' end,
      v_link);
  else
    insert into public.notifications(employee_id, typ, titel, nachricht, link)
    values (new.assigned_to, 'warnung', 'Beanstandet: ' || new.title,
      coalesce(nullif(trim(coalesce(new.review_note, '')), ''), 'Bitte nacharbeiten und erneut zur Prüfung einreichen.') ||
        ' (geprüft von ' || coalesce(trim(v_reviewer), 'deiner Leitung') || ')',
      v_link);
  end if;
  return new;
end $$;

drop trigger if exists operational_tasks_notify_reviewed on public.operational_tasks;
create trigger operational_tasks_notify_reviewed after update of status on public.operational_tasks
  for each row execute function public.notify_task_reviewed();

-- Beanstandung atomar: Ablehnung (Benachrichtigung via Trigger) und Wiedereröffnung in EINER Transaktion.
create or replace function public.reject_operational_task_as_actor(p_task_id uuid, p_tenant_id uuid, p_location_id uuid, p_actor_id uuid, p_review_note text)
returns setof public.operational_tasks language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if nullif(trim(coalesce(p_review_note, '')), '') is null then
    raise exception 'review note required';
  end if;
  -- bestehende Rechte-/Zustandsprüfung wiederverwenden (setzt reviewed_by/at + review_note, Trigger benachrichtigt)
  perform public.update_operational_task_as_actor(p_task_id, p_tenant_id, p_location_id, p_actor_id, 'nicht_bestanden', p_review_note);
  -- direkt wieder öffnen: Nacharbeit möglich, Historie (reviewed_by/review_note) bleibt
  return query
  update public.operational_tasks
    set status = 'offen', completed_at = null, updated_at = now()
    where id = p_task_id and tenant_id = p_tenant_id and location_id = p_location_id
    returning *;
end $$;

revoke all on function public.reject_operational_task_as_actor(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reject_operational_task_as_actor(uuid, uuid, uuid, uuid, text) to service_role;
