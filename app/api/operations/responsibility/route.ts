import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentEmployee, type CurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { berlinScheduleMoment, isResponsibilityScheduleActive, type ResponsibilitySchedule } from '@/lib/operations/responsibility-scope';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const uuid = z.string().uuid();
const optionalUuid = z.union([uuid, z.literal(''), z.null()]).optional();
const managerRoles = new Set(['manager', 'backoffice', 'admin']);
const terminalTaskStates = new Set(['erledigt', 'nicht_bestanden', 'storniert']);

const requestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('save_department'), locationId: uuid, id: optionalUuid,
    name: z.string().trim().min(2).max(100), aktiv: z.boolean().default(true),
    priority: z.number().int().min(0).max(100), primaryRequired: z.boolean(), deputyRequired: z.boolean(),
    duties: z.array(z.string().trim().min(1).max(300)).max(40),
  }),
  z.object({
    action: z.literal('assign_responsibility'), locationId: uuid, departmentId: uuid,
    employeeId: optionalUuid, role: z.enum(['hauptverantwortung', 'stellvertretung']),
    weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7).default([1, 2, 3, 4, 5, 6, 7]),
    shiftStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
    shiftEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  }),
  z.object({
    action: z.literal('move_employee'), locationId: uuid, employeeId: uuid, reportsToEmployeeId: optionalUuid,
    positionTitle: z.string().trim().max(100).optional(),
  }),
  z.object({
    action: z.literal('create_task'), locationId: uuid, departmentId: optionalUuid,
    title: z.string().trim().min(2).max(160), description: z.string().trim().max(3000).optional(),
    assignedTo: optionalUuid, accountableEmployeeId: optionalUuid, controllerEmployeeId: optionalUuid,
    dueAt: z.string().datetime({ offset: true }).nullable().optional(), priority: z.number().int().min(0).max(100),
    evidenceRequirements: z.array(z.enum(['foto', 'kommentar', 'dokument', 'unterschrift', 'messwert'])).max(5),
  }),
  z.object({
    action: z.literal('update_task'), locationId: uuid, taskId: uuid,
    status: z.enum(['angenommen', 'in_arbeit', 'wartet_auf_pruefung', 'erledigt', 'nicht_bestanden', 'blockiert', 'storniert']),
    reviewNote: z.string().trim().max(2000).optional(),
  }),
  z.object({
    action: z.literal('create_handover'), locationId: uuid, departmentId: optionalUuid,
    toEmployeeId: uuid, reason: z.enum(['schichtende', 'urlaub', 'krankheit', 'sonstiges']),
    startsAt: z.string().datetime({ offset: true }), endsAt: z.string().datetime({ offset: true }).nullable().optional(),
    note: z.string().trim().min(2).max(3000),
  }),
  z.object({
    action: z.literal('accept_handover'), locationId: uuid, handoverId: uuid,
  }),
]);

type Service = ReturnType<typeof createServiceClient>;

async function canAccessLocation(service: Service, actor: CurrentEmployee, locationId: string) {
  if (!actor.tenant_id) return false;
  if (!['backoffice', 'admin'].includes(actor.rolle)) return actor.location_id === locationId;
  const { data } = await service.from('locations').select('id').eq('id', locationId).eq('tenant_id', actor.tenant_id).maybeSingle();
  return Boolean(data);
}

async function isDepartmentLead(service: Service, actor: CurrentEmployee, departmentId: string | null | undefined) {
  if (!actor.tenant_id || !departmentId) return false;
  const moment = berlinScheduleMoment();
  const { data } = await service.from('department_responsibility_assignments')
    .select('valid_from,valid_until,weekday_scope,shift_start,shift_end')
    .eq('tenant_id', actor.tenant_id).eq('department_id', departmentId).eq('employee_id', actor.id)
    .eq('aktiv', true).lte('valid_from', moment.date)
    .or(`valid_until.is.null,valid_until.gte.${moment.previousDate}`);
  return ((data ?? []) as ResponsibilitySchedule[]).some((assignment) => isResponsibilityScheduleActive(assignment, moment));
}

async function employeeInScope(service: Service, tenantId: string, locationId: string, employeeId: string) {
  const { data } = await service.from('employees').select('id').eq('id', employeeId)
    .eq('tenant_id', tenantId).eq('location_id', locationId)
    .in('status', ['aktiv', 'in_training', 'in_probe']).maybeSingle();
  return Boolean(data);
}

async function departmentInScope(service: Service, tenantId: string, locationId: string, departmentId: string) {
  const { data } = await service.from('departments').select('id').eq('id', departmentId)
    .eq('tenant_id', tenantId).eq('location_id', locationId).maybeSingle();
  return Boolean(data);
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

  try {
    if (input.action === 'save_department') {
      if (!managerRoles.has(actor.rolle)) return forbidden();
      const payload = {
        tenant_id: actor.tenant_id, location_id: input.locationId, name: input.name,
        aktiv: input.aktiv, prioritaet: input.priority,
        hauptverantwortung_erforderlich: input.primaryRequired,
        stellvertretung_erforderlich: input.deputyRequired,
        pflichten: input.duties,
      };
      const query = input.id
        ? service.from('departments').update(payload).eq('id', input.id).eq('tenant_id', actor.tenant_id).eq('location_id', input.locationId)
        : service.from('departments').insert(payload);
      const { data, error } = await query.select('*').maybeSingle();
      if (error || !data) return failure(error?.message ?? 'Bereich konnte nicht gespeichert werden.');
      return NextResponse.json({ department: data });
    }

    if (input.action === 'assign_responsibility') {
      if (!managerRoles.has(actor.rolle)) return forbidden();
      const { data: department } = await service.from('departments').select('id').eq('id', input.departmentId)
        .eq('tenant_id', actor.tenant_id).eq('location_id', input.locationId).maybeSingle();
      if (!department) return notFound('Bereich nicht gefunden.');
      const employeeId = input.employeeId || null;
      if (employeeId && !await employeeInScope(service, actor.tenant_id, input.locationId, employeeId)) {
        return NextResponse.json({ error: 'Mitarbeiter gehört nicht zu diesem Standort.' }, { status: 400 });
      }
      if (employeeId) {
        const opposite = input.role === 'hauptverantwortung' ? 'stellvertretung' : 'hauptverantwortung';
        const { data: conflict } = await service.from('department_responsibility_assignments').select('id')
          .eq('department_id', input.departmentId).eq('employee_id', employeeId).eq('responsibility_role', opposite)
          .eq('aktiv', true).limit(1);
        if (conflict?.length) return NextResponse.json({ error: 'Hauptverantwortung und Stellvertretung müssen verschiedene Personen sein.' }, { status: 409 });
      }
      const { data, error } = await service.rpc('replace_department_responsibility', {
        p_tenant_id: actor.tenant_id,
        p_location_id: input.locationId,
        p_department_id: input.departmentId,
        p_employee_id: employeeId,
        p_role: input.role,
        p_weekdays: input.weekdays,
        p_shift_start: input.shiftStart || null,
        p_shift_end: input.shiftEnd || null,
        p_assigned_by: actor.id,
      });
      if (error) return failure(error.message);
      return NextResponse.json({ assignment: Array.isArray(data) ? data[0] ?? null : data ?? null });
    }

    if (input.action === 'move_employee') {
      if (!managerRoles.has(actor.rolle)) return forbidden();
      const parentId = input.reportsToEmployeeId || null;
      const { data: employees } = await service.from('employees').select('id,reports_to_employee_id')
        .eq('tenant_id', actor.tenant_id).eq('location_id', input.locationId);
      const rows = employees ?? [];
      if (!rows.some((employee) => employee.id === input.employeeId)) return notFound('Mitarbeiter nicht gefunden.');
      if (parentId && !rows.some((employee) => employee.id === parentId)) return notFound('Vorgesetzte Person nicht gefunden.');
      let cursor = parentId;
      const byId = new Map(rows.map((employee) => [employee.id, employee.reports_to_employee_id]));
      const visited = new Set<string>();
      while (cursor) {
        if (cursor === input.employeeId) return NextResponse.json({ error: 'Diese Zuordnung würde einen Hierarchie-Kreis erzeugen.' }, { status: 409 });
        if (visited.has(cursor)) return NextResponse.json({ error: 'Die bestehende Führungslinie enthält einen Kreis und muss zuerst korrigiert werden.' }, { status: 409 });
        visited.add(cursor);
        cursor = byId.get(cursor) ?? null;
      }
      const { data, error } = await service.rpc('move_employee_in_organization', {
        p_tenant_id: actor.tenant_id,
        p_location_id: input.locationId,
        p_employee_id: input.employeeId,
        p_reports_to_employee_id: parentId,
        p_position_title: input.positionTitle || null,
        p_update_position: input.positionTitle !== undefined,
        p_actor_id: actor.id,
      });
      const moved = Array.isArray(data) ? data[0] ?? null : data ?? null;
      if (error || !moved) return failure(error?.message ?? 'Zuordnung fehlgeschlagen.');
      return NextResponse.json({ employee: moved });
    }

    if (input.action === 'create_task') {
      const departmentId = input.departmentId || null;
      if (departmentId && !await departmentInScope(service, actor.tenant_id, input.locationId, departmentId)) {
        return notFound('Bereich gehört nicht zu diesem Standort.');
      }
      const manages = managerRoles.has(actor.rolle);
      if (!manages && !await isDepartmentLead(service, actor, departmentId)) return forbidden();
      const referenced = [input.assignedTo, input.accountableEmployeeId, input.controllerEmployeeId].filter(Boolean) as string[];
      for (const employeeId of referenced) {
        if (!await employeeInScope(service, actor.tenant_id, input.locationId, employeeId)) {
          return NextResponse.json({ error: 'Eine ausgewählte Person gehört nicht zu diesem Standort.' }, { status: 400 });
        }
      }
      let accountable = input.accountableEmployeeId || null;
      if (!accountable && departmentId) {
        const moment = berlinScheduleMoment();
        const { data } = await service.from('department_responsibility_assignments')
          .select('employee_id,valid_from,valid_until,weekday_scope,shift_start,shift_end')
          .eq('tenant_id', actor.tenant_id).eq('location_id', input.locationId).eq('department_id', departmentId)
          .eq('responsibility_role', 'hauptverantwortung').eq('aktiv', true)
          .lte('valid_from', moment.date).or(`valid_until.is.null,valid_until.gte.${moment.previousDate}`)
          .order('valid_from', { ascending: false });
        const current = (data ?? []).find((assignment) => isResponsibilityScheduleActive(assignment as ResponsibilitySchedule, moment));
        accountable = current?.employee_id ?? null;
      }
      if (accountable && !await employeeInScope(service, actor.tenant_id, input.locationId, accountable)) {
        return NextResponse.json({ error: 'Die konfigurierte Hauptverantwortung gehört nicht zu diesem Standort.' }, { status: 409 });
      }
      if (!accountable) accountable = actor.id;
      if (!manages) accountable = actor.id;
      const assignee = input.assignedTo || accountable;
      const { data, error } = await service.from('operational_tasks').insert({
        tenant_id: actor.tenant_id, location_id: input.locationId, department_id: departmentId,
        title: input.title, description: input.description || null, created_by: actor.id,
        assigned_to: assignee, accountable_employee_id: accountable,
        controller_employee_id: input.controllerEmployeeId || accountable,
        delegated_from_employee_id: assignee !== accountable ? accountable : null,
        due_at: input.dueAt || null, priority: input.priority,
        evidence_requirements: input.evidenceRequirements,
      }).select('*').single();
      if (error) return failure(error.message);
      return NextResponse.json({ task: data });
    }

    if (input.action === 'update_task') {
      const { data: task } = await service.from('operational_tasks').select('*').eq('id', input.taskId)
        .eq('tenant_id', actor.tenant_id).eq('location_id', input.locationId).maybeSingle();
      if (!task) return notFound('Aufgabe nicht gefunden.');
      const manages = managerRoles.has(actor.rolle);
      const isAssignee = task.assigned_to === actor.id;
      const isReviewer = task.accountable_employee_id === actor.id || task.controller_employee_id === actor.id;
      const isLead = await isDepartmentLead(service, actor, task.department_id);
      if (!manages && !isAssignee && !isReviewer && !isLead) return forbidden();
      if (terminalTaskStates.has(task.status)) return NextResponse.json({ error: 'Abgeschlossene Aufgaben können nicht erneut geändert werden.' }, { status: 409 });
      if (['erledigt', 'nicht_bestanden'].includes(input.status) && !manages && !isReviewer) return forbidden();
      if (['angenommen', 'in_arbeit', 'wartet_auf_pruefung', 'blockiert'].includes(input.status) && !manages && !isAssignee && !isReviewer) return forbidden();
      if (input.status === 'wartet_auf_pruefung') {
        const requirements = Array.isArray(task.evidence_requirements)
          ? task.evidence_requirements.filter((item: unknown): item is string => typeof item === 'string')
          : [];
        if (requirements.length) {
          const { data: evidence } = await service.from('operational_task_evidence').select('evidence_type')
            .eq('task_id', task.id).eq('tenant_id', actor.tenant_id);
          const submitted = new Set((evidence ?? []).map((item) => item.evidence_type));
          const missing = requirements.filter((requirement: string) => !submitted.has(requirement));
          if (missing.length) return NextResponse.json({ error: `Erforderliche Nachweise fehlen: ${missing.join(', ')}` }, { status: 409 });
        }
      }
      const patch: Record<string, unknown> = { status: input.status };
      if (input.status === 'angenommen') patch.accepted_at = new Date().toISOString();
      if (input.status === 'in_arbeit') patch.started_at = new Date().toISOString();
      if (['erledigt', 'nicht_bestanden'].includes(input.status)) {
        patch.reviewed_by = actor.id;
        patch.reviewed_at = new Date().toISOString();
        patch.review_note = input.reviewNote || null;
      }
      const { data, error } = await service.from('operational_tasks').update(patch).eq('id', task.id).select('*').single();
      if (error) return failure(error.message);
      if (['erledigt', 'nicht_bestanden'].includes(input.status)) {
        await service.from('operational_task_evidence').update({
          verification_status: input.status === 'erledigt' ? 'akzeptiert' : 'abgelehnt',
          verified_by: actor.id, verified_at: new Date().toISOString(), verification_note: input.reviewNote || null,
        }).eq('task_id', task.id).eq('verification_status', 'offen');
      }
      return NextResponse.json({ task: data });
    }

    if (input.action === 'create_handover') {
      if (input.departmentId && !await departmentInScope(service, actor.tenant_id, input.locationId, input.departmentId)) {
        return notFound('Bereich gehört nicht zu diesem Standort.');
      }
      const manages = managerRoles.has(actor.rolle);
      if (!manages && !await isDepartmentLead(service, actor, input.departmentId || null)) return forbidden();
      if (!await employeeInScope(service, actor.tenant_id, input.locationId, input.toEmployeeId) || input.toEmployeeId === actor.id) {
        return NextResponse.json({ error: 'Vertretung ist ungültig.' }, { status: 400 });
      }
      const { data, error } = await service.from('responsibility_handovers').insert({
        tenant_id: actor.tenant_id, location_id: input.locationId, department_id: input.departmentId || null,
        from_employee_id: actor.id, to_employee_id: input.toEmployeeId, reason: input.reason,
        starts_at: input.startsAt, ends_at: input.endsAt || null, note: input.note,
      }).select('*').single();
      if (error) return failure(error.message);
      return NextResponse.json({ handover: data });
    }

    const { data: handover } = await service.from('responsibility_handovers').select('id,to_employee_id,status')
      .eq('id', input.handoverId).eq('tenant_id', actor.tenant_id).eq('location_id', input.locationId).maybeSingle();
    if (!handover) return notFound('Übergabe nicht gefunden.');
    if (handover.to_employee_id !== actor.id && !managerRoles.has(actor.rolle)) return forbidden();
    const { data, error } = await service.from('responsibility_handovers').update({
      status: 'angenommen', accepted_by: actor.id, accepted_at: new Date().toISOString(),
    }).eq('id', handover.id).eq('status', 'offen').select('*').maybeSingle();
    if (error || !data) return NextResponse.json({ error: 'Übergabe wurde bereits bearbeitet.' }, { status: 409 });
    return NextResponse.json({ handover: data });
  } catch (error) {
    return failure(error instanceof Error ? error.message : 'Aktion fehlgeschlagen.');
  }
}

function forbidden() {
  return NextResponse.json({ error: 'Keine Berechtigung für diese Aktion.' }, { status: 403 });
}

function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
}

function failure(message: string) {
  const safeMessage = /outside tenant|overlap|constraint/i.test(message)
    ? 'Die Zuordnung überschneidet sich oder gehört nicht zum ausgewählten Standort.'
    : message;
  return NextResponse.json({ error: safeMessage }, { status: 500 });
}
