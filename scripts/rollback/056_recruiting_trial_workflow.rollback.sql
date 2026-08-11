-- The enum value `abgelehnt` intentionally remains: PostgreSQL enum values
-- cannot be removed safely while rows or dependent objects may reference it.

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
  if NEW.status not in ('in_training', 'in_probe', 'aktiv') then return NEW; end if;

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
