import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createServiceClient } from '@/lib/supabase/server';

const scores = z.object({
  punktlichkeit: z.number().int().min(1).max(5),
  arbeitsqualitaet: z.number().int().min(1).max(5),
  kundenumgang: z.number().int().min(1).max(5),
  teamwork: z.number().int().min(1).max(5),
  lernbereitschaft: z.number().int().min(1).max(5),
});

const schema = z.object({
  scores,
  decision: z.enum(['einstellen', 'verlaengern', 'ablehnen']),
  staerken: z.string().trim().max(3000).optional(),
  entwicklung: z.string().trim().max(3000).optional(),
  kommentar: z.string().trim().max(3000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const currentEmployee = await requireManagerPlus();
  if (!currentEmployee.tenant_id) {
    return NextResponse.json({ error: 'Mitarbeiterkonto ist keinem Mandanten zugeordnet.' }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Bitte alle fünf Kriterien bewerten und eine Entscheidung wählen.' }, { status: 400 });
  }

  const sb = createServiceClient();
  const { data: application } = await sb.from('employees')
    .select('id,status,beworben_am,created_at')
    .eq('id', id)
    .eq('tenant_id', currentEmployee.tenant_id)
    .maybeSingle();
  if (!application || application.status !== 'in_probe') {
    return NextResponse.json({ error: 'Nur laufende Probearbeiten können bewertet werden.' }, { status: 409 });
  }

  const { data: trialShifts } = await sb.from('shifts')
    .select('id,start_zeit,end_zeit')
    .eq('employee_id', id)
    .eq('typ', 'probe')
    .gte('created_at', application.beworben_am ?? application.created_at)
    .lte('end_zeit', new Date().toISOString())
    .order('start_zeit');
  if (!trialShifts?.length) {
    return NextResponse.json({ error: 'Vor der Bewertung muss mindestens eine Probearbeit beendet sein.' }, { status: 409 });
  }

  const scoreValues = Object.values(parsed.data.scores);
  const total = scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length;
  const first = trialShifts[0];
  const last = trialShifts[trialShifts.length - 1];
  const { data: review, error: reviewError } = await sb.from('performance_reviews').insert({
    employee_id: id,
    reviewer_id: currentEmployee.id,
    zeitraum_von: first.start_zeit.slice(0, 10),
    zeitraum_bis: last.end_zeit.slice(0, 10),
    gesamtnote: total,
    kategorien: { ...parsed.data.scores, entscheidung: parsed.data.decision, art: 'probearbeit' },
    stärken: parsed.data.staerken || null,
    entwicklungsfelder: parsed.data.entwicklung || null,
    kommentar_mitarbeiter: parsed.data.kommentar || null,
    abgeschlossen: true,
  }).select('id').single();
  if (reviewError || !review) {
    return NextResponse.json({ error: reviewError?.message ?? 'Bewertung konnte nicht gespeichert werden.' }, { status: 500 });
  }

  const nextStatus = parsed.data.decision === 'einstellen'
    ? 'in_training'
    : parsed.data.decision === 'ablehnen'
      ? 'abgelehnt'
      : 'in_probe';
  const finalDecision = parsed.data.decision !== 'verlaengern';
  const employeeUpdate: Record<string, unknown> = {
    status: nextStatus,
    angenommen_am: parsed.data.decision === 'einstellen' ? new Date().toISOString() : null,
    eintrittsdatum: parsed.data.decision === 'einstellen' ? new Date().toISOString().slice(0, 10) : null,
  };
  if (finalDecision) {
    employeeUpdate.invite_token = null;
    employeeUpdate.invite_expires_at = null;
  }
  const { error: updateError } = await sb.from('employees').update(employeeUpdate)
    .eq('id', id)
    .eq('tenant_id', currentEmployee.tenant_id);
  if (updateError) {
    await sb.from('performance_reviews').delete().eq('id', review.id);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: nextStatus, review_id: review.id });
}
