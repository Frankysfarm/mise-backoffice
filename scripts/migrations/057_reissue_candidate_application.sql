-- Reissuing an application must reset employee and wizard state in one
-- transaction. The function is callable only with the server-side service role.

create or replace function public.reissue_candidate_application(
  p_employee_id uuid,
  p_tenant_id uuid,
  p_vorname text,
  p_nachname text,
  p_location_id uuid,
  p_invite_token text,
  p_invite_expires_at timestamptz,
  p_beworben_am timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  updated_id uuid;
begin
  update public.employees
  set invite_token = p_invite_token,
      invite_expires_at = p_invite_expires_at,
      vorname = p_vorname,
      nachname = p_nachname,
      location_id = p_location_id,
      department_id = null,
      status = 'registriert',
      beworben_am = p_beworben_am,
      angenommen_am = null,
      eintrittsdatum = null,
      onboarding_completed_at = null,
      onboarding_step = null,
      geburtsdatum = null,
      telefon = null,
      adresse_strasse = null,
      adresse_plz = null,
      adresse_stadt = null,
      position_typ = null,
      employment_type = null,
      wochenstunden = null
  where id = p_employee_id
    and tenant_id = p_tenant_id
    and status in ('registriert', 'wartet_zuteilung', 'abgelehnt')
  returning id into updated_id;

  if updated_id is null then
    return false;
  end if;

  insert into public.onboarding_progress (
    employee_id,
    aktueller_step,
    daten,
    zuletzt_aktiv_am,
    erinnerung_24h_gesendet,
    erinnerung_48h_gesendet,
    erinnerung_72h_gesendet,
    abgeschlossen
  ) values (
    updated_id,
    0,
    '{}'::jsonb,
    p_beworben_am,
    false,
    false,
    false,
    false
  )
  on conflict (employee_id) do update
  set aktueller_step = 0,
      daten = '{}'::jsonb,
      zuletzt_aktiv_am = excluded.zuletzt_aktiv_am,
      erinnerung_24h_gesendet = false,
      erinnerung_48h_gesendet = false,
      erinnerung_72h_gesendet = false,
      abgeschlossen = false,
      updated_at = now();

  return true;
end
$function$;

revoke all on function public.reissue_candidate_application(uuid, uuid, text, text, uuid, text, timestamptz, timestamptz) from public;
revoke all on function public.reissue_candidate_application(uuid, uuid, text, text, uuid, text, timestamptz, timestamptz) from anon;
revoke all on function public.reissue_candidate_application(uuid, uuid, text, text, uuid, text, timestamptz, timestamptz) from authenticated;
grant execute on function public.reissue_candidate_application(uuid, uuid, text, text, uuid, text, timestamptz, timestamptz) to service_role;
