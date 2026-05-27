import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = createServiceClient();
  const { data: emp } = await sb.from('employees')
    .select('id,status,invite_expires_at').eq('invite_token', token).maybeSingle();
  if (!emp) return NextResponse.json({ error: 'invalid_token' }, { status: 404 });
  if (emp.invite_expires_at && new Date(emp.invite_expires_at) < new Date()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 });
  }

  const { data: progress } = await sb.from('onboarding_progress')
    .select('daten').eq('employee_id', emp.id).maybeSingle();
  const daten = (progress?.daten as Record<string, any>) ?? {};

  // Daten auf employees schreiben (nur gesetzte Felder, Rest behalten)
  const updates: Record<string, any> = {};
  const map: Record<string, string> = {
    geburtsdatum: 'geburtsdatum', telefon: 'telefon',
    adresse_strasse: 'adresse_strasse', adresse_plz: 'adresse_plz', adresse_stadt: 'adresse_stadt',
    steuer_id: 'steuer_id', sv_nummer: 'sv_nummer', krankenkasse: 'krankenkasse', krankenkasse_nr: 'krankenkasse_nr',
    iban: 'iban', employment_type: 'employment_type', position_typ: 'position_typ',
    wochenstunden: 'wochenstunden',
  };
  for (const [dk, ek] of Object.entries(map)) {
    if (daten[dk] !== undefined && daten[dk] !== '') updates[ek] = daten[dk];
  }
  updates.status = 'wartet_zuteilung';
  updates.beworben_am = new Date().toISOString();

  const { error } = await sb.from('employees').update(updates).eq('id', emp.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from('onboarding_progress').update({ abgeschlossen: true }).eq('employee_id', emp.id);

  return NextResponse.json({ ok: true });
}
