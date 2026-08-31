import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { ResponsibilityClient } from './responsibility-client';

export const dynamic = 'force-dynamic';

function berlinDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export default async function MitarbeiterPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const actor = await requireManagerPlus();
  if (!actor.tenant_id) redirect('/start');
  const requested = (await searchParams).location;
  const service = createServiceClient();
  const mayUseAllLocations = ['backoffice', 'admin'].includes(actor.rolle);
  if (!mayUseAllLocations && !actor.location_id) redirect('/start');
  let locationsQuery = service.from('locations').select('id,name,stadt')
    .eq('tenant_id', actor.tenant_id);
  if (!mayUseAllLocations) locationsQuery = locationsQuery.eq('id', actor.location_id!);
  const { data: locations } = await locationsQuery.order('name');
  const availableLocations = locations ?? [];
  const locationId = mayUseAllLocations && requested && availableLocations.some((location) => location.id === requested)
    ? requested
    : actor.location_id ?? availableLocations[0]?.id;
  if (!locationId) redirect('/start');
  if (!availableLocations.some((location) => location.id === locationId)) redirect('/start');
  const today = berlinDate();

  const [
    { data: employees }, { data: departments }, { data: assignments }, { data: tasks },
    { data: templates }, { data: handovers }, { data: coverage }, { data: briefing },
  ] = await Promise.all([
    service.from('employees')
      .select('id,vorname,nachname,rolle,status,department_id,reports_to_employee_id,position_title,organization_level,avatar_url')
      .eq('tenant_id', actor.tenant_id).eq('location_id', locationId)
      .in('status', ['aktiv', 'in_training', 'in_probe']).order('nachname'),
    service.from('departments')
      .select('id,name,aktiv,prioritaet,hauptverantwortung_erforderlich,stellvertretung_erforderlich,pflichten,geltungsregeln')
      .eq('tenant_id', actor.tenant_id).eq('location_id', locationId).order('prioritaet', { ascending: false }),
    service.from('department_responsibility_assignments')
      .select('id,department_id,employee_id,responsibility_role,weekday_scope,shift_start,shift_end,valid_from,valid_until,aktiv')
      .eq('tenant_id', actor.tenant_id).eq('location_id', locationId).eq('aktiv', true),
    service.from('operational_tasks')
      .select('id,department_id,template_id,shift_id,title,description,status,priority,created_by,assigned_to,accountable_employee_id,controller_employee_id,due_at,completed_at,evidence_requirements,escalation_level,review_note,created_at,shift:shifts(start_zeit,end_zeit,position),evidence:operational_task_evidence(id,evidence_type,verification_status)')
      .eq('tenant_id', actor.tenant_id).eq('location_id', locationId)
      .not('status', 'eq', 'storniert').order('due_at', { ascending: true, nullsFirst: false }).limit(300),
    service.from('operational_task_templates')
      .select('id,department_id,title,description,task_kind,trigger_type,shift_phase,due_offset_minutes,assignment_mode,assigned_employee_id,accountable_employee_id,controller_employee_id,evidence_requirements,control_required,priority,aktiv,created_at')
      .eq('tenant_id', actor.tenant_id).eq('location_id', locationId)
      .eq('trigger_type', 'shift')
      .order('priority', { ascending: false }).order('title'),
    service.from('responsibility_handovers')
      .select('id,department_id,from_employee_id,to_employee_id,reason,starts_at,ends_at,note,status,accepted_at,created_at')
      .eq('tenant_id', actor.tenant_id).eq('location_id', locationId)
      .in('status', ['offen', 'angenommen']).order('starts_at'),
    service.from('v_responsibility_coverage').select('*')
      .eq('tenant_id', actor.tenant_id).eq('location_id', locationId),
    service.from('operational_daily_briefings')
      .select('briefing_date,generated_at,shifts,task_counts,coverage_gaps,absences,escalated_tasks')
      .eq('tenant_id', actor.tenant_id).eq('location_id', locationId).eq('briefing_date', today)
      .maybeSingle(),
  ]);

  const employeeIds = (employees ?? []).map((employee) => employee.id);
  const { data: absences } = employeeIds.length
    ? await service.from('availability_exceptions').select('employee_id,datum,typ')
      .in('employee_id', employeeIds).eq('datum', today)
    : { data: [] };

  return (
    <ResponsibilityClient
      key={locationId}
      actorId={actor.id}
      locationId={locationId}
      locations={availableLocations}
      canSelectLocation={mayUseAllLocations}
      employees={(employees ?? []) as never[]}
      departments={(departments ?? []) as never[]}
      assignments={(assignments ?? []) as never[]}
      tasks={(tasks ?? []) as never[]}
      templates={(templates ?? []) as never[]}
      handovers={(handovers ?? []) as never[]}
      coverage={(coverage ?? []) as never[]}
      absences={(absences ?? []) as never[]}
      briefing={(briefing ?? null) as never}
    />
  );
}
