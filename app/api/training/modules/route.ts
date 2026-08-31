import { NextRequest, NextResponse } from 'next/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createServiceClient } from '@/lib/supabase/server';
import { trainingModuleSchema } from '@/lib/training/domain';

export async function POST(request: NextRequest) {
  const actor = await requireManagerPlus(); if (!actor.tenant_id) return NextResponse.json({ error: 'Betrieb fehlt.' }, { status: 403 });
  const parsed = trainingModuleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Bitte Schulung und Inhalte vollständig ausfüllen.', details: parsed.error.flatten() }, { status: 400 });
  const value = parsed.data; const service = createServiceClient();
  for (const target of value.targets) {
    if (target.type === 'location' && !(await service.from('locations').select('id').eq('id', target.locationId).eq('tenant_id', actor.tenant_id).maybeSingle()).data) return NextResponse.json({ error: 'Standort liegt außerhalb des Betriebs.' }, { status: 400 });
    if (target.type === 'department' && !(await service.from('departments').select('id').eq('id', target.departmentId).eq('tenant_id', actor.tenant_id).maybeSingle()).data) return NextResponse.json({ error: 'Bereich liegt außerhalb des Betriebs.' }, { status: 400 });
  }
  const safeBlocks = value.blocks.map((block) => block.type === 'quiz' ? { ...block, correctOptionIds: undefined, points: undefined, mustPass: undefined } : block);
  const modulePayload = { tenant_id: actor.tenant_id, titel: value.title, beschreibung: value.description || null, kategorie: value.category || null, dauer_minuten: value.durationMinutes ?? null, pflicht: value.required, aktiv: value.active, passing_threshold: value.passingThreshold, deadline_days: value.deadlineDays ?? null, recurrence_months: value.recurrenceMonths ?? null, gültig_monate: value.recurrenceMonths ?? null, inhalt: { lessons: safeBlocks }, updated_at: new Date().toISOString() };
  const targets = value.targets.map((target) => ({ target_type: target.type, location_id: target.type === 'location' ? target.locationId : null, department_id: target.type === 'department' ? target.departmentId : null, position_type: target.type === 'position' ? target.positionType.toLowerCase() : null }));
  const keys = value.blocks.filter((block): block is Extract<typeof block, { type: 'quiz' }> => block.type === 'quiz').map((block) => ({ question_id: block.id, correct_option_ids: [...block.correctOptionIds].sort(), points: block.points, must_pass: block.mustPass }));
  const { data: moduleId, error } = await service.rpc('save_training_module', { p_id: value.id ?? null, p_tenant_id: actor.tenant_id, p_actor_id: actor.id, p_module: modulePayload, p_targets: targets, p_keys: keys });
  if (error || !moduleId) return NextResponse.json({ error: 'Schulung konnte nicht gespeichert werden.' }, { status: 400 });
  return NextResponse.json({ id: moduleId });
}
