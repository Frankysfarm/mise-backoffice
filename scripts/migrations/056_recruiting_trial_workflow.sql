-- Recruiting workflow: application -> trial shift -> review -> onboarding/rejection.
-- Run before deploying the matching application release.

alter type public.employee_status add value if not exists 'abgelehnt' after 'wartet_zuteilung';

-- A candidate in a trial shift is not an employee in training yet. Required
-- training is assigned only after the hiring decision moves the person into
-- onboarding (`in_training`) or directly into active employment.
create or replace function public.assign_training_on_department_change()
returns trigger
language plpgsql
as $function$
declare
  dep_name text;
begin
  if NEW.department_id is null then return NEW; end if;
  if TG_OP = 'UPDATE' and OLD.department_id is not distinct from NEW.department_id
     and OLD.status is not distinct from NEW.status then
    return NEW;
  end if;
  if NEW.status not in ('in_training', 'aktiv') then return NEW; end if;

  select name into dep_name from public.departments where id = NEW.department_id;
  if dep_name is null then return NEW; end if;

  insert into public.training_progress (employee_id, module_id, fortschritt_prozent)
  select NEW.id, m.id, 0
  from public.training_modules m
  where m.aktiv = true
    and m.pflicht = true
    and (
      m.kategorie ilike '%' || dep_name || '%'
      or m.position_typ = NEW.position_typ
    )
  on conflict (employee_id, module_id) do nothing;

  return NEW;
end
$function$;
