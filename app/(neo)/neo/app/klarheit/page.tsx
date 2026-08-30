import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { KlarheitClient } from './klarheit-client';

export const dynamic = 'force-dynamic';

function berlinDateParts(value: Date): { year: number; month: number; day: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
    })
      .formatToParts(value)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  return { year: parts.year, month: parts.month, day: parts.day };
}

function berlinMidnight(year: number, month: number, day: number): Date {
  const targetAsUtc = Date.UTC(year, month - 1, day);
  let instant = targetAsUtc;
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = berlinDateParts(new Date(instant));
    const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
    instant -= localAsUtc - targetAsUtc;
    const hour = Number(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Berlin', hour: '2-digit', hourCycle: 'h23',
    }).format(new Date(instant)));
    instant -= hour * 60 * 60 * 1000;
  }
  return new Date(instant);
}

function berlinTodayBounds(now = new Date()): { start: Date; end: Date; date: string } {
  const local = berlinDateParts(now);
  const date = `${String(local.year).padStart(4, '0')}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`;
  const start = berlinMidnight(local.year, local.month, local.day);
  const next = new Date(Date.UTC(local.year, local.month - 1, local.day + 1));
  const nextParts = berlinDateParts(next);
  const end = berlinMidnight(nextParts.year, nextParts.month, nextParts.day);
  return { start, end, date };
}

export default async function KlarheitPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const actor = await requireManagerPlus();
  if (!actor.tenant_id || !actor.location_id) redirect('/start');
  const requested = (await searchParams).location;
  const service = createServiceClient();
  const { data: locations } = await service.from('locations')
    .select('id,name,stadt')
    .eq('tenant_id', actor.tenant_id).order('name');
  const availableLocations = locations ?? [];
  const mayUseAllLocations = ['backoffice', 'admin'].includes(actor.rolle);
  const locationId = mayUseAllLocations && requested && availableLocations.some((location) => location.id === requested)
    ? requested
    : actor.location_id;
  if (!availableLocations.some((location) => location.id === locationId)) redirect('/start');

  const { start: todayStart, end: todayEnd, date: todayDate } = berlinTodayBounds();
  const now = new Date().toISOString();

  const [
    { data: departments },
    { data: employees },
  ] = await Promise.all([
    service.from('departments')
      .select('id,name,aktiv,prioritaet')
      .eq('tenant_id', actor.tenant_id).eq('location_id', locationId)
      .eq('aktiv', true).order('prioritaet', { ascending: false }),
    service.from('employees')
      .select('id,vorname,nachname,rolle,position_title,department_id')
      .eq('tenant_id', actor.tenant_id).eq('location_id', locationId)
      .in('status', ['aktiv', 'in_training', 'in_probe']).order('nachname'),
  ]);

  const employeeIds = (employees ?? []).map((employee) => employee.id);

  const [
    { data: shifts },
    { data: tasks },
    { data: coverage },
    { data: absences },
  ] = await Promise.all([
    service.from('shifts')
      .select('id,start_zeit,end_zeit,status,position,typ,employee:employees!shifts_employee_id_fkey(id,vorname,nachname,rolle,position_title),department:departments(id,name)')
      .eq('tenant_id', actor.tenant_id).eq('location_id', locationId)
      .lt('start_zeit', todayEnd.toISOString())
      .gt('end_zeit', todayStart.toISOString())
      .order('start_zeit', { ascending: true }),
    service.from('operational_tasks')
      .select('id,department_id,title,status,priority,due_at,escalation_level,assigned_to,assignee:employees!operational_tasks_assigned_to_fkey(vorname,nachname)')
      .eq('tenant_id', actor.tenant_id).eq('location_id', locationId)
      .in('status', ['offen', 'angenommen', 'in_arbeit', 'wartet_auf_pruefung', 'blockiert'])
      .lte('due_at', todayEnd.toISOString())
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(300),
    service.from('v_responsibility_coverage')
      .select('*')
      .eq('tenant_id', actor.tenant_id).eq('location_id', locationId)
      .neq('abdeckungsstatus', 'abgedeckt'),
    employeeIds.length
      ? service.from('availability_exceptions')
        .select('id,employee_id,datum,typ,grund,employee:employees!availability_exceptions_employee_id_fkey(vorname,nachname,rolle,position_title)')
        .eq('tenant_id', actor.tenant_id)
        .in('employee_id', employeeIds)
        .eq('datum', todayDate)
        .in('typ', ['krank', 'urlaub', 'abwesend', 'gesperrt', 'nicht_verfuegbar', 'unavailable', 'sick'])
        .order('typ')
      : { data: [] },
  ]);

  return (
    <KlarheitClient
      key={locationId}
      actorId={actor.id}
      locationId={locationId}
      locations={availableLocations}
      canSelectLocation={mayUseAllLocations}
      departments={(departments ?? []) as never[]}
      employees={(employees ?? []) as never[]}
      shifts={(shifts ?? []) as never[]}
      tasks={(tasks ?? []) as never[]}
      coverage={(coverage ?? []) as never[]}
      absences={(absences ?? []) as never[]}
      todayDate={todayDate}
      todayEnd={todayEnd.toISOString()}
      now={now}
    />
  );
}
