/**
 * POST /api/driver-app/pause
 *
 * Phase 1393 — Schicht-Pause-Timer
 * Protokolliert Pausenstart und -ende eines Fahrers.
 *
 * Body: { driver_id, action: 'start'|'end', timestamp, dauer_sek? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PauseBody {
  driver_id: string;
  action: 'start' | 'end';
  timestamp: string;
  dauer_sek?: number | null;
}

export async function POST(req: NextRequest) {
  let body: Partial<PauseBody>;
  try {
    body = (await req.json()) as Partial<PauseBody>;
  } catch {
    return NextResponse.json({ error: 'Ungültiges JSON' }, { status: 400 });
  }

  const { driver_id, action, timestamp, dauer_sek } = body;
  if (!driver_id || !action || !timestamp) {
    return NextResponse.json({ error: 'driver_id, action und timestamp erforderlich' }, { status: 400 });
  }
  if (action !== 'start' && action !== 'end') {
    return NextResponse.json({ error: 'action muss "start" oder "end" sein' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    if (action === 'start') {
      // Offenen Pausen-Eintrag anlegen
      await supabase.from('driver_pause_logs').insert({
        driver_id,
        start_at: timestamp,
        ende_at: null,
        dauer_sek: null,
      });
    } else {
      // Letzten offenen Eintrag schließen
      const { data: open } = await supabase
        .from('driver_pause_logs')
        .select('id')
        .eq('driver_id', driver_id)
        .is('ende_at', null)
        .order('start_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (open) {
        await supabase
          .from('driver_pause_logs')
          .update({ ende_at: timestamp, dauer_sek: dauer_sek ?? null })
          .eq('id', open.id);
      }
    }
  } catch {
    // Tabelle existiert ggf. noch nicht — kein Fehler zurück, Client hat localStorage-Fallback
  }

  return NextResponse.json({ ok: true, action, recorded_at: new Date().toISOString() });
}
