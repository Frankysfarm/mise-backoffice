import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentEmployee, type CurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';
import { berlinScheduleWeek } from '@/lib/scheduling/berlin-week';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const uuid = z.string().uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const managerActions = z.discriminatedUnion('action', [
  z.object({ action: z.literal('open'), locationId: uuid, weekStart: day, deadline: z.string().datetime() }),
  z.object({ action: z.literal('apply'), locationId: uuid, templateId: uuid, weekStart: day, deadline: z.string().datetime().nullable().optional() }),
  z.object({ action: z.literal('publish'), locationId: uuid, weekStart: day }),
  z.object({ action: z.literal('remind'), locationId: uuid, weekStart: day }),
  z.object({ action: z.enum(['createTemplate', 'updateTemplate']), locationId: uuid, templateId: uuid.nullable().optional(), name: z.string().min(2).max(120), description: z.string().max(500).optional(), slots: z.array(z.object({ weekday: z.number().int().min(0).max(6), name: z.string().min(1).max(120), departmentId: uuid.nullable().optional(), position: z.string().max(100).optional(), startTime: z.string().regex(/^\d{2}:\d{2}$/), endTime: z.string().regex(/^\d{2}:\d{2}$/), pauseMinutes: z.number().int().min(0).max(240), headcount: z.number().int().min(1).max(50), sortOrder: z.number().int() })) }),
  z.object({ action: z.enum(['copyTemplate', 'deleteTemplate']), locationId: uuid, templateId: uuid }),
]);
const availabilityAction = z.object({ action: z.literal('availability'), shiftId: uuid, state: z.enum(['kann', 'moechte', 'kann_nicht']), applied: z.boolean().default(false) });

export async function POST(request: NextRequest) {
  const actor = await getCurrentEmployee();
  if (!actor?.tenant_id) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const availability = availabilityAction.safeParse(body);
  const service = createServiceClient();
  if (availability.success) {
    const { data: shift } = await service.from('shifts').select('id,tenant_id,location_id,start_zeit,offen_fuer_bewerbung').eq('id', availability.data.shiftId).eq('tenant_id', actor.tenant_id).maybeSingle();
    if (!shift || shift.location_id !== actor.location_id || !shift.offen_fuer_bewerbung) return NextResponse.json({ error: 'Diese Schicht ist nicht zur Rückmeldung freigegeben.' }, { status: 403 });
    const weekStart = berlinScheduleWeek(undefined, new Date(shift.start_zeit)).calendarStart;
    const { data: scheduleWeek } = await service.from('schedule_weeks').select('id,availability_deadline,status').eq('tenant_id', actor.tenant_id).eq('location_id', shift.location_id).eq('week_start', weekStart).maybeSingle();
    if (!scheduleWeek) return NextResponse.json({ error: 'Die Planungsrunde wurde noch nicht geöffnet.' }, { status: 409 });
    if (scheduleWeek.status !== 'draft' || (scheduleWeek.availability_deadline && Date.parse(scheduleWeek.availability_deadline) < Date.now())) return NextResponse.json({ error: 'Die Eintragungsfrist ist abgelaufen.' }, { status: 409 });
    const { error } = await service.from('shift_availability_responses').upsert({ tenant_id: actor.tenant_id, location_id: shift.location_id, schedule_week_id: scheduleWeek.id, shift_id: shift.id, employee_id: actor.id, state: availability.data.state, applied: availability.data.applied, updated_at: new Date().toISOString() }, { onConflict: 'shift_id,employee_id' });
    return error ? NextResponse.json({ error: 'Rückmeldung konnte nicht gespeichert werden.' }, { status: 400 }) : NextResponse.json({ ok: true });
  }
  const parsed = managerActions.safeParse(body);
  if (!parsed.success || !['manager', 'backoffice', 'admin'].includes(actor.rolle)) return NextResponse.json({ error: 'Eingaben oder Berechtigung sind ungültig.' }, { status: 403 });
  const input = parsed.data;
  if (!await canAccessLocation(service, actor, input.locationId)) return NextResponse.json({ error: 'Standort nicht freigegeben.' }, { status: 403 });
  if (input.action === 'createTemplate' || input.action === 'updateTemplate' || input.action === 'copyTemplate' || input.action === 'deleteTemplate') {
    const rpcAction = input.action === 'createTemplate' ? 'create' : input.action === 'updateTemplate' ? 'update' : input.action === 'copyTemplate' ? 'copy' : 'delete';
    const { data, error } = await service.rpc('manage_schedule_template', { p_tenant_id: actor.tenant_id, p_location_id: input.locationId, p_actor_id: actor.id, p_action: rpcAction, p_template_id: 'templateId' in input ? input.templateId ?? null : null, p_name: 'name' in input ? input.name : null, p_description: 'description' in input ? input.description ?? null : null, p_slots: 'slots' in input ? input.slots : [] });
    return error ? failure(error.message) : NextResponse.json({ ok: true, templateId: data });
  }
  if (input.action === 'open') {
    const { error } = await service.rpc('open_schedule_week', { p_tenant_id: actor.tenant_id, p_location_id: input.locationId, p_actor_id: actor.id, p_week_start: input.weekStart, p_deadline: input.deadline });
    return error ? failure(error.message) : NextResponse.json({ ok: true, message: 'Die Woche ist für Rückmeldungen geöffnet.' });
  }
  if (input.action === 'apply') {
    const { data, error } = await service.rpc('apply_schedule_template', { p_tenant_id: actor.tenant_id, p_location_id: input.locationId, p_actor_id: actor.id, p_template_id: input.templateId, p_week_start: input.weekStart, p_deadline: input.deadline ?? null });
    return error ? failure(error.message) : NextResponse.json({ ok: true, created: data, message: data ? `${data} offene Schichten erstellt.` : 'Die Vorlage war bereits vollständig angewendet; keine Duplikate erstellt.' });
  }
  if (input.action === 'publish') {
    const { data, error } = await service.rpc('publish_schedule_week', { p_tenant_id: actor.tenant_id, p_location_id: input.locationId, p_actor_id: actor.id, p_week_start: input.weekStart });
    return error ? failure(error.message) : NextResponse.json({ ok: true, notified: data });
  }
  if (input.action !== 'remind') return NextResponse.json({ error: 'Unbekannte Dienstplan-Aktion.' }, { status: 400 });
  const { data: week } = await service.from('schedule_weeks').select('id,availability_deadline').eq('tenant_id', actor.tenant_id).eq('location_id', input.locationId).eq('week_start', input.weekStart).maybeSingle();
  if (!week) return NextResponse.json({ error: 'Planungswoche wurde noch nicht geöffnet.' }, { status: 409 });
  const { data: employees } = await service.from('employees').select('id,email').eq('tenant_id', actor.tenant_id).eq('location_id', input.locationId).eq('status', 'aktiv');
  const germanWeek = new Date(`${input.weekStart}T12:00:00Z`).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' });
  const rows = (employees ?? []).map((employee) => ({ employee_id: employee.id, typ: 'dienstplan_verfuegbarkeit', titel: 'Verfügbarkeit eintragen', nachricht: `Bitte trage deine Verfügbarkeit für die Woche ab ${germanWeek} ein.`, link: '/mitarbeiter#verfuegbarkeit' }));
  if (rows.length) await service.from('notifications').insert(rows);
  const mails = (employees ?? []).filter((employee) => employee.email).map((employee) => ({ tenant_id: actor.tenant_id, to_email: employee.email!, subject: 'Verfügbarkeit für den Dienstplan', html: null, template: 'schedule_availability_reminder', template_data: { employee_id: employee.id, week_start: input.weekStart } }));
  if (mails.length) await service.from('email_outbox').insert(mails);
  return NextResponse.json({ ok: true, notified: rows.length, emailQueued: mails.length });
}

async function canAccessLocation(service: ReturnType<typeof createServiceClient>, actor: CurrentEmployee, locationId: string) {
  if (!actor.tenant_id || !['manager', 'backoffice', 'admin'].includes(actor.rolle)) return false;
  if (actor.rolle === 'manager') return actor.location_id === locationId;
  const { data } = await service.from('locations').select('id').eq('id', locationId).eq('tenant_id', actor.tenant_id).maybeSingle();
  return Boolean(data);
}
const failure = (message: string) => {
  if (message.includes('not allowed') || message.includes('outside')) return NextResponse.json({ error: 'Standort nicht freigegeben.' }, { status: 403 });
  if (message.includes('published schedule')) return NextResponse.json({ error: 'Eine bereits veröffentlichte Woche kann nicht erneut vorbereitet werden.' }, { status: 409 });
  if (message.includes('deadline')) return NextResponse.json({ error: 'Bitte eine gültige Eintragungsfrist setzen.' }, { status: 409 });
  return NextResponse.json({ error: 'Dienstplan-Aktion konnte nicht ausgeführt werden.' }, { status: 400 });
};
