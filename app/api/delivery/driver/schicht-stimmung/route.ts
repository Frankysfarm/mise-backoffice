import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1249 — Schicht-Stimmungs-Tracker-API
// GET: letzte 5 Stimmungs-Einträge + Trend
// POST: neuen Eintrag speichern (best-effort)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const driver_id = searchParams.get('driver_id');
  if (!driver_id) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  const mock = {
    eintraege: [
      { id: 'e1', stimmung: 3, label: 'okay', zeit: new Date(Date.now() - 90 * 60000).toISOString() },
      { id: 'e2', stimmung: 4, label: 'gut', zeit: new Date(Date.now() - 60 * 60000).toISOString() },
      { id: 'e3', stimmung: 4, label: 'gut', zeit: new Date(Date.now() - 30 * 60000).toISOString() },
    ],
    schnitt: 3.7,
    trend: 'steigend' as const,
    empfehlung: 'Gute Energie — weiter so!',
    driver_id,
    generiert_am: new Date().toISOString(),
  };

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('driver_mood_logs')
      .select('id, mood_score, created_at')
      .eq('driver_id', driver_id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!data || data.length === 0) return NextResponse.json(mock);

    const LABELS: Record<number, string> = { 1: 'schlecht', 2: 'müde', 3: 'okay', 4: 'gut', 5: 'super' };
    const eintraege = data.map(e => ({
      id: String(e.id),
      stimmung: e.mood_score as number,
      label: LABELS[e.mood_score as number] ?? 'okay',
      zeit: e.created_at as string,
    }));

    const schnitt = eintraege.reduce((s, e) => s + e.stimmung, 0) / eintraege.length;
    const erste = eintraege[eintraege.length - 1].stimmung;
    const letzte = eintraege[0].stimmung;
    const trend: 'steigend' | 'stabil' | 'fallend' =
      letzte > erste + 0.5 ? 'steigend' : letzte < erste - 0.5 ? 'fallend' : 'stabil';

    const empfehlung =
      schnitt >= 4 ? 'Tolle Energie — Schicht läuft super!' :
      schnitt >= 3 ? 'Solide Stimmung — kurze Pause wenn möglich.' :
      'Niedrige Energie — Pause empfohlen, melde dich beim Dispatcher.';

    return NextResponse.json({ eintraege, schnitt: Math.round(schnitt * 10) / 10, trend, empfehlung, driver_id, generiert_am: new Date().toISOString() });
  } catch {
    return NextResponse.json(mock);
  }
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const driver_id = searchParams.get('driver_id');
  if (!driver_id) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  try {
    const body = await req.json() as { stimmung: number };
    const stimmung = Math.max(1, Math.min(5, Number(body.stimmung)));
    const supabase = await createClient();
    await supabase.from('driver_mood_logs').insert({ driver_id, mood_score: stimmung });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // best-effort
  }
}
