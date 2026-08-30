import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentEmployee, type CurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const uuid = z.string().uuid();
const weekStart = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const managerRoles = new Set(['manager', 'backoffice', 'admin']);
const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('generate'), locationId: uuid, weekStart }),
  z.object({ action: z.literal('confirm'), locationId: uuid, weekStart, suggestionId: uuid }),
]);

type Service = ReturnType<typeof createServiceClient>;

async function canAccessLocation(service: Service, actor: CurrentEmployee, locationId: string) {
  if (!actor.tenant_id || !managerRoles.has(actor.rolle)) return false;
  if (!['backoffice', 'admin'].includes(actor.rolle)) return actor.location_id === locationId;
  const { data } = await service.from('locations').select('id')
    .eq('id', locationId).eq('tenant_id', actor.tenant_id).maybeSingle();
  return Boolean(data);
}

async function listSuggestions(
  service: Service,
  tenantId: string,
  locationId: string,
  selectedWeek: string,
) {
  const { data: rows, error } = await service.from('weekly_shift_assignment_suggestions')
    .select('id,shift_id,employee_id,score,reason,status,generated_at')
    .eq('tenant_id', tenantId).eq('location_id', locationId)
    .eq('week_start', selectedWeek).eq('status', 'draft')
    .order('generated_at').order('shift_id');
  if (error) throw error;
  const suggestions = rows ?? [];
  if (!suggestions.length) return [];

  const shiftIds = suggestions.map((row) => row.shift_id);
  const employeeIds = [...new Set(suggestions.map((row) => row.employee_id))];
  const [{ data: shifts, error: shiftError }, { data: employees, error: employeeError }] = await Promise.all([
    service.from('shifts')
      .select('id,start_zeit,end_zeit,position,department_id,employee_id,department:departments(name)')
      .eq('tenant_id', tenantId).eq('location_id', locationId).in('id', shiftIds),
    service.from('employees').select('id,vorname,nachname')
      .eq('tenant_id', tenantId).eq('location_id', locationId).in('id', employeeIds),
  ]);
  if (shiftError || employeeError) throw shiftError ?? employeeError;
  const shiftsById = new Map((shifts ?? []).map((row) => [row.id, row]));
  const employeesById = new Map((employees ?? []).map((row) => [row.id, row]));
  return suggestions.map((row) => ({
    ...row,
    shift: shiftsById.get(row.shift_id) ?? null,
    employee: employeesById.get(row.employee_id) ?? null,
  }));
}

export async function GET(request: NextRequest) {
  const actor = await getCurrentEmployee();
  if (!actor?.tenant_id) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  const url = new URL(request.url);
  const parsed = z.object({ locationId: uuid, weekStart }).safeParse({
    locationId: url.searchParams.get('locationId'),
    weekStart: url.searchParams.get('weekStart'),
  });
  if (!parsed.success) return NextResponse.json({ error: 'Standort und Wochenbeginn fehlen.' }, { status: 400 });
  const service = createServiceClient();
  if (!await canAccessLocation(service, actor, parsed.data.locationId)) {
    return NextResponse.json({ error: 'Standort nicht freigegeben' }, { status: 403 });
  }
  try {
    const suggestions = await listSuggestions(service, actor.tenant_id, parsed.data.locationId, parsed.data.weekStart);
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ error: 'Vorschläge konnten nicht geladen werden.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const actor = await getCurrentEmployee();
  if (!actor?.tenant_id) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Eingaben sind unvollständig oder ungültig.' }, { status: 400 });
  const input = parsed.data;
  const service = createServiceClient();
  if (!await canAccessLocation(service, actor, input.locationId)) {
    return NextResponse.json({ error: 'Standort nicht freigegeben' }, { status: 403 });
  }

  const rpc = input.action === 'generate'
    ? await service.rpc('generate_weekly_shift_assignment_suggestions', {
      p_tenant_id: actor.tenant_id,
      p_location_id: input.locationId,
      p_week_start: input.weekStart,
      p_actor_id: actor.id,
    })
    : await service.rpc('confirm_weekly_shift_assignment_suggestion', {
      p_tenant_id: actor.tenant_id,
      p_location_id: input.locationId,
      p_suggestion_id: input.suggestionId,
      p_actor_id: actor.id,
    });
  if (rpc.error) return scheduleFailure(rpc.error.message);

  try {
    const suggestions = await listSuggestions(service, actor.tenant_id, input.locationId, input.weekStart);
    return NextResponse.json({ ok: true, suggestions });
  } catch {
    return NextResponse.json({ error: 'Aktualisierte Vorschläge konnten nicht geladen werden.' }, { status: 500 });
  }
}

function scheduleFailure(message: string) {
  if (message.includes('outside location') || message.includes('not allowed')) {
    return NextResponse.json({ error: 'Standort nicht freigegeben.' }, { status: 403 });
  }
  if (message.includes('no longer') || message.includes('double-booked') || message.includes('available') || message.includes('qualified')) {
    return NextResponse.json({ error: 'Der Vorschlag ist nicht mehr aktuell. Bitte neu berechnen.' }, { status: 409 });
  }
  return NextResponse.json({ error: 'Wochenvorschläge konnten nicht verarbeitet werden.' }, { status: 400 });
}
