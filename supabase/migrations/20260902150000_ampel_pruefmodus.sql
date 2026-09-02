-- Paket 2 „Ampel + Prüfmodus" (02.09.2026):
-- Prüfergebnis erreicht den Mitarbeiter sofort: freigegeben ⇒ Erfolg, beanstandet ⇒ Warnung mit Grund.
-- (E-Mail automatisch über die Brücke notifications → email_outbox.)

create or replace function public.notify_task_reviewed()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_reviewer text;
begin
  if new.status not in ('erledigt','nicht_bestanden') or old.status is not distinct from new.status then return new; end if;
  if new.assigned_to is null then return new; end if;
  -- Nur echte Prüfungen melden: jemand anderes als der Mitarbeiter hat entschieden
  if coalesce(new.reviewed_by, new.assigned_to) = new.assigned_to then return new; end if;
  select vorname || ' ' || coalesce(nachname, '') into v_reviewer from public.employees where id = new.reviewed_by;
  if new.status = 'erledigt' then
    insert into public.notifications(employee_id, typ, titel, nachricht, link)
    values (new.assigned_to, 'erfolg', 'Geprüft & freigegeben: ' || new.title,
      coalesce(trim(v_reviewer), 'Deine Leitung') || ' hat deine Arbeit geprüft und freigegeben.' ||
        case when nullif(trim(coalesce(new.review_note, '')), '') is not null then ' Anmerkung: ' || new.review_note else '' end,
      '/mitarbeiter#meine-aufgaben');
  else
    insert into public.notifications(employee_id, typ, titel, nachricht, link)
    values (new.assigned_to, 'warnung', 'Beanstandet: ' || new.title,
      coalesce(nullif(trim(coalesce(new.review_note, '')), ''), 'Bitte nacharbeiten und erneut zur Prüfung einreichen.') ||
        ' (geprüft von ' || coalesce(trim(v_reviewer), 'deiner Leitung') || ')',
      '/mitarbeiter#meine-aufgaben');
  end if;
  return new;
end $$;

drop trigger if exists operational_tasks_notify_reviewed on public.operational_tasks;
create trigger operational_tasks_notify_reviewed after update of status on public.operational_tasks
  for each row execute function public.notify_task_reviewed();
