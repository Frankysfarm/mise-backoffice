import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePosAccess } from '@/lib/auth/requireRole';
import { createServiceClient } from '@/lib/supabase/server';
const schema = z.object({ answers: z.record(z.array(z.string().min(1))) });
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const employee = await requirePosAccess(); const { id } = await params; if (!employee.tenant_id) return NextResponse.json({ error: 'Betrieb fehlt.' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Antworten sind unvollständig.' }, { status: 400 }); const service = createServiceClient();
  const { data: progress } = await service.from('training_progress').select('id,module_id,attempt_count,module:training_modules(passing_threshold,recurrence_months)').eq('id', id).eq('employee_id', employee.id).eq('tenant_id', employee.tenant_id).maybeSingle(); if (!progress) return NextResponse.json({ error: 'Schulung nicht gefunden.' }, { status: 404 });
  const { data: keys } = await service.from('training_quiz_keys').select('question_id,correct_option_ids,points,must_pass').eq('module_id', progress.module_id);
  let earned = 0; let max = 0; let mustFailed = false; for (const key of keys ?? []) { const actual = [...(parsed.data.answers[key.question_id] ?? [])].sort(); const expected = [...(key.correct_option_ids as string[])].sort(); const correct = actual.length === expected.length && actual.every((v, i) => v === expected[i]); max += key.points; if (correct) earned += key.points; if (key.must_pass && !correct) mustFailed = true; }
  const score = max ? Math.round(earned / max * 10_000) / 100 : 100; const passed = score >= Number((progress.module as any)?.passing_threshold ?? 80) && !mustFailed; const now = new Date(); const attempt = progress.attempt_count + 1;
  const { error } = await service.from('training_attempts').insert({ tenant_id: employee.tenant_id, progress_id: progress.id, employee_id: employee.id, module_id: progress.module_id, attempt_number: attempt, answers_json: parsed.data.answers, earned_points: earned, max_points: max, score_percent: score, passed, must_pass_failed: mustFailed }); if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await service.from('training_progress').update({ attempt_count: attempt, last_attempt_at: now.toISOString(), testergebnis: score, fortschritt_prozent: 100, abgeschlossen: passed, status: passed ? 'bestanden' : 'begonnen', passed_at: passed ? now.toISOString() : null, expires_at: passed && (progress.module as any)?.recurrence_months ? new Date(now.setMonth(now.getMonth() + (progress.module as any).recurrence_months)).toISOString() : null, updated_at: new Date().toISOString() }).eq('id', progress.id).eq('employee_id', employee.id);
  return NextResponse.json({ passed, score });
}
