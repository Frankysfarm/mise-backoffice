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
  let moduleId = value.id ?? null;
  if (moduleId) {
    const { data, error } = await service.from('training_modules').update(modulePayload).eq('id', moduleId).eq('tenant_id', actor.tenant_id).select('id').maybeSingle();
    if (error || !data) return NextResponse.json({ error: error?.message ?? 'Schulung nicht gefunden.' }, { status: 400 });
  } else {
    const { data, error } = await service.from('training_modules').insert(modulePayload).select('id').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 }); moduleId = data.id;
  }
  await Promise.all([service.from('training_module_targets').delete().eq('module_id', moduleId).eq('tenant_id', actor.tenant_id), service.from('training_quiz_keys').delete().eq('module_id', moduleId).eq('tenant_id', actor.tenant_id)]);
  const targets = value.targets.map((target) => ({ tenant_id: actor.tenant_id!, module_id: moduleId!, target_type: target.type, location_id: target.type === 'location' ? target.locationId : null, department_id: target.type === 'department' ? target.departmentId : null, position_type: target.type === 'position' ? target.positionType.toLowerCase() : null }));
  const keys = value.blocks.filter((block): block is Extract<typeof block, { type: 'quiz' }> => block.type === 'quiz').map((block) => ({ tenant_id: actor.tenant_id!, module_id: moduleId!, question_id: block.id, correct_option_ids: [...block.correctOptionIds].sort(), points: block.points, must_pass: block.mustPass, updated_at: new Date().toISOString() }));
  const targetError = targets.length ? (await service.from('training_module_targets').insert(targets)).error : null; const keyError = keys.length ? (await service.from('training_quiz_keys').insert(keys)).error : null;
  if (targetError || keyError) return NextResponse.json({ error: targetError?.message ?? keyError?.message }, { status: 400 });
  return NextResponse.json({ id: moduleId });
}
