import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Public API — gesichert nur durch Besitz des Invite-Tokens.
// GET  /api/register/<token>       → aktuellen Stand laden
// PATCH /api/register/<token>      → Schritt speichern (auto-save)
// POST /api/register/<token>/submit → abschließen, Status → wartet_zuteilung

async function loadByToken(token: string) {
  const sb = createServiceClient();
  const { data: emp } = await sb.from('employees')
    .select('id,email,vorname,nachname,invite_expires_at,status,department_id,location_id,angenommen_am,beworben_am,onboarding_completed_at')
    .eq('invite_token', token).maybeSingle();
  if (!emp) return { sb, emp: null, progress: null };
  if (emp.invite_expires_at && new Date(emp.invite_expires_at) < new Date()) {
    return { sb, emp: null, progress: null, expired: true };
  }
  const { data: progress } = await sb.from('onboarding_progress')
    .select('*').eq('employee_id', emp.id).maybeSingle();
  return { sb, emp, progress };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { emp, progress, expired } = await loadByToken(token);
  if (!emp) return NextResponse.json({ error: expired ? 'expired' : 'not_found' }, { status: 404 });
  return NextResponse.json({
    employee: { id: emp.id, email: emp.email, vorname: emp.vorname, nachname: emp.nachname, status: emp.status },
    progress: progress ? { step: progress.aktueller_step, daten: progress.daten, abgeschlossen: progress.abgeschlossen } : null,
  });
}

const patchSchema = z.object({
  step: z.number().int().min(0).max(10),
  daten: z.record(z.any()),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { sb, emp, progress } = await loadByToken(token);
  if (!emp) return NextResponse.json({ error: 'invalid_token' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const payload = {
    employee_id: emp.id,
    aktueller_step: parsed.data.step,
    daten: { ...((progress?.daten as any) ?? {}), ...parsed.data.daten },
    zuletzt_aktiv_am: new Date().toISOString(),
  };

  if (progress) {
    const { error } = await sb.from('onboarding_progress').update(payload).eq('id', progress.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await sb.from('onboarding_progress').insert(payload);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
