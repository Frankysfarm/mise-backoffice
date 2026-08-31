import { NextRequest, NextResponse } from 'next/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createServiceClient } from '@/lib/supabase/server';
import { trainingAssignmentSchema } from '@/lib/training/domain';
export async function POST(request: NextRequest) {
  const actor = await requireManagerPlus(); if (!actor.tenant_id) return NextResponse.json({ error: 'Betrieb fehlt.' }, { status: 403 });
  const parsed = trainingAssignmentSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Schulung und Mitarbeiter auswählen.' }, { status: 400 });
  const service = createServiceClient(); const { data: module } = await service.from('training_modules').select('id,deadline_days').eq('id', parsed.data.moduleId).eq('tenant_id', actor.tenant_id).maybeSingle(); if (!module) return NextResponse.json({ error: 'Schulung nicht gefunden.' }, { status: 404 });
  let employeeQuery = service.from('employees').select('id').eq('tenant_id', actor.tenant_id).in('status', ['aktiv', 'in_training']);
  if (!parsed.data.allActive) employeeQuery = employeeQuery.in('id', parsed.data.employeeIds!);
  const { data: employees } = await employeeQuery;
  if (!parsed.data.allActive && employees?.length !== new Set(parsed.data.employeeIds!).size) return NextResponse.json({ error: 'Mindestens ein Mitarbeiter liegt außerhalb des Betriebs.' }, { status: 400 });
  const assignedAt = new Date(); const dueAt = module.deadline_days ? new Date(assignedAt.getTime() + module.deadline_days * 86_400_000).toISOString() : null;
  const assignableEmployees = employees ?? [];
  const { error } = await service.from('training_progress').upsert(assignableEmployees.map((employee) => ({ tenant_id: actor.tenant_id!, employee_id: employee.id, module_id: module.id, fortschritt_prozent: 0, abgeschlossen: false, status: 'offen', assigned_at: assignedAt.toISOString(), due_at: dueAt, assignment_source: 'manual', assigned_by: actor.id, updated_at: assignedAt.toISOString() })), { onConflict: 'employee_id,module_id', ignoreDuplicates: true });
  return error ? NextResponse.json({ error: 'Die Schulung konnte nicht zugewiesen werden.' }, { status: 400 }) : NextResponse.json({ assigned: assignableEmployees.length });
}
