import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';
import { berlinScheduleMoment, isResponsibilityScheduleActive, type ResponsibilitySchedule } from '@/lib/operations/responsibility-scope';
import { validateRecurrenceRule, type RecurrenceRule } from '@/lib/operations/recurrence';

export const dynamic = 'force-dynamic';
const uuid = z.string().uuid();
const optionalUuid = z.union([uuid, z.literal(''), z.null()]).optional();
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save_rule'), locationId: uuid, id: optionalUuid, title: z.string().trim().min(2).max(160), description: z.string().trim().max(3000).default(''), departmentId: optionalUuid, recurrenceRule: z.record(z.unknown()), targetType: z.enum(['employee','role','department','shift','location']), targetEmployeeId: optionalUuid, targetRole: z.string().trim().max(80).optional(), priority: z.number().int().min(0).max(100), active: z.boolean() }),
  z.object({ action: z.enum(['pause_rule','resume_rule','delete_rule']), locationId: uuid, id: uuid }),
  z.object({ action: z.literal('materialize'), locationId: uuid }),
  z.object({ action: z.literal('create_handover'), locationId: uuid, departmentId: optionalUuid, toEmployeeId: uuid, openTaskIds: z.array(uuid).max(100), incidents: z.string().trim().max(4000).default(''), inventoryNotes: z.string().trim().max(4000).default(''), damageNotes: z.string().trim().max(4000).default(''), cleaningNotes: z.string().trim().max(4000).default(''), importantNotes: z.string().trim().max(4000).default(''), evidence: z.array(z.record(z.unknown())).max(10).default([]) }),
  z.object({ action: z.enum(['read_handover','confirm_handover']), locationId: uuid, id: uuid }),
]);

export async function POST(request: NextRequest) {
  const actor = await getCurrentEmployee();
  if (!actor?.tenant_id) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });
  const actorTenantId = actor.tenant_id;
  const actorId = actor.id;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Eingaben sind unvollständig oder ungültig.' }, { status: 400 });
  const input = parsed.data;
  const service = createServiceClient();
  const companyWide = ['backoffice', 'admin'].includes(actor.rolle);
  if (!companyWide && actor.location_id !== input.locationId) return NextResponse.json({ error: 'Standort nicht freigegeben.' }, { status: 403 });
  if (companyWide) {
    const { data } = await service.from('locations').select('id').eq('id', input.locationId).eq('tenant_id', actor.tenant_id).maybeSingle();
    if (!data) return NextResponse.json({ error: 'Standort nicht freigegeben.' }, { status: 403 });
  }
  const manager = ['manager', 'backoffice', 'admin'].includes(actor.rolle);
  async function isDepartmentLead(departmentId: string | null | undefined) {
    if (!departmentId) return false;
    const moment = berlinScheduleMoment();
    const { data } = await service.from('department_responsibility_assignments').select('valid_from,valid_until,weekday_scope,shift_start,shift_end')
      .eq('tenant_id', actorTenantId).eq('location_id', input.locationId).eq('department_id', departmentId).eq('employee_id', actorId)
      .eq('aktiv', true).lte('valid_from', moment.date).or(`valid_until.is.null,valid_until.gte.${moment.previousDate}`);
    return ((data ?? []) as ResponsibilitySchedule[]).some((assignment) => isResponsibilityScheduleActive(assignment, moment));
  }
  try {
    if (input.action === 'save_rule') {
      if (!manager) return forbidden();
      if (!validateRecurrenceRule(input.recurrenceRule as RecurrenceRule)) return NextResponse.json({ error: 'Wiederholung ist unvollständig oder ungültig.' }, { status: 400 });
      const { data, error } = await service.rpc('save_recurring_operational_template', { p_id: input.id || null, p_tenant_id: actor.tenant_id, p_location_id: input.locationId, p_actor_id: actor.id, p_title: input.title, p_description: input.description, p_department_id: input.departmentId || null, p_recurrence_rule: input.recurrenceRule, p_target_type: input.targetType, p_target_employee_id: input.targetEmployeeId || null, p_target_role: input.targetRole || null, p_priority: input.priority, p_active: input.active });
      if (error) throw error;
      return NextResponse.json({ rule: Array.isArray(data) ? data[0] : data });
    }
    if (input.action === 'pause_rule' || input.action === 'resume_rule' || input.action === 'delete_rule') {
      if (!manager) return forbidden();
      const payload = input.action === 'pause_rule' ? { aktiv: false, paused_at: new Date().toISOString() } : input.action === 'resume_rule' ? { aktiv: true, paused_at: null } : { aktiv: false, deleted_at: new Date().toISOString() };
      const { data, error } = await service.from('operational_task_templates').update(payload).eq('id', input.id).eq('tenant_id', actor.tenant_id).eq('location_id', input.locationId).select('id').maybeSingle();
      if (error || !data) return NextResponse.json({ error: 'Regel wurde nicht gefunden.' }, { status: 404 });
      if (input.action !== 'resume_rule') await service.from('operational_tasks').update({ status: 'storniert' }).eq('template_id', input.id).eq('tenant_id', actor.tenant_id).eq('location_id', input.locationId).eq('status', 'offen').gt('recurrence_due_at', new Date().toISOString());
      return NextResponse.json({ ok: true });
    }
    if (input.action === 'materialize') {
      if (!manager) return forbidden();
      const { data, error } = await service.rpc('materialize_recurring_operational_tasks', { p_tenant_id: actor.tenant_id, p_location_id: input.locationId, p_until: new Date(Date.now() + 14 * 86_400_000).toISOString() });
      if (error) throw error;
      return NextResponse.json({ created: data ?? 0 });
    }
    if (input.action === 'create_handover') {
      if (!manager && !await isDepartmentLead(input.departmentId || null)) return forbidden();
      const { data: recipient } = await service.from('employees').select('id').eq('id', input.toEmployeeId).eq('tenant_id', actor.tenant_id).eq('location_id', input.locationId).maybeSingle();
      if (!recipient || recipient.id === actor.id) return NextResponse.json({ error: 'Folgeschicht ist ungültig.' }, { status: 400 });
      const { data, error } = await service.from('responsibility_handovers').insert({ tenant_id: actor.tenant_id, location_id: input.locationId, department_id: input.departmentId || null, from_employee_id: actor.id, to_employee_id: recipient.id, reason: 'schichtende', starts_at: new Date().toISOString(), note: input.importantNotes || input.incidents || 'Übergabe ohne zusätzliche Hinweise', open_task_ids: input.openTaskIds, incidents: input.incidents || null, inventory_notes: input.inventoryNotes || null, damage_notes: input.damageNotes || null, cleaning_notes: input.cleaningNotes || null, important_notes: input.importantNotes || null, evidence: input.evidence }).select('*').single();
      if (error) throw error;
      return NextResponse.json({ handover: data });
    }
    const action = input.action === 'read_handover' ? 'read' : 'confirm';
    const { data, error } = await service.rpc('acknowledge_responsibility_handover', { p_handover_id: input.id, p_actor_id: actor.id, p_action: action });
    if (error) return NextResponse.json({ error: action === 'confirm' ? 'Erst lesen, dann bestätigen.' : 'Übergabe konnte nicht geöffnet werden.' }, { status: 409 });
    return NextResponse.json({ handover: Array.isArray(data) ? data[0] : data });
  } catch (error) {
    console.error('Operations action failed', error);
    return NextResponse.json({ error: 'Die Aktion konnte nicht gespeichert werden. Bitte erneut versuchen.' }, { status: 500 });
  }
}

function forbidden() { return NextResponse.json({ error: 'Keine Berechtigung für diese Aktion.' }, { status: 403 }); }
