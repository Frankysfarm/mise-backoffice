/**
 * GET /api/delivery/driver/energie-prognose
 *
 * Phase 979 — Backend: Schicht-Energie-Prognose
 * Prognose verbleibende Energie + Pausen-Empfehlung
 * basierend auf bisheriger Schicht-Intensität.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface EnergiePrognose {
  energie_pct: number;
  schicht_dauer_min: number;
  stopps_absolviert: number;
  intensitaet: 'niedrig' | 'mittel' | 'hoch';
  pause_empfohlen: boolean;
  pause_in_min: number | null;
  prognose_restdauer_min: number;
  empfehlung: string;
  generiert_am: string;
}

function buildMock(): EnergiePrognose {
  return {
    energie_pct: 68,
    schicht_dauer_min: 180,
    stopps_absolviert: 6,
    intensitaet: 'mittel',
    pause_empfohlen: false,
    pause_in_min: null,
    prognose_restdauer_min: 240,
    empfehlung: 'Energie stabil — weiter so!',
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const driverId = searchParams.get('driver_id') ?? '';

  try {
    const supabase = await createClient();
    const heute = new Date().toISOString().slice(0, 10);
    const now = new Date();

    // Aktive Schicht
    const { data: schicht } = await supabase
      .from('driver_shifts')
      .select('id, start_time, end_time, status')
      .eq('driver_id', driverId)
      .gte('start_time', `${heute}T00:00:00`)
      .in('status', ['aktiv', 'active', 'gestartet'])
      .order('start_time', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!schicht) {
      return NextResponse.json(buildMock());
    }

    const startMs = new Date(schicht.start_time).getTime();
    const schichtDauerMin = Math.round((now.getTime() - startMs) / 60_000);

    // Stopps heute
    const { data: stops } = await supabase
      .from('mise_delivery_stops')
      .select('id, status, completed_at')
      .eq('driver_id', driverId)
      .gte('created_at', `${heute}T00:00:00`);

    const stoppsGesamt = stops?.length ?? 0;
    const stoppsAbge = (stops ?? []).filter((s: { status?: string }) =>
      ['geliefert', 'abgeschlossen', 'delivered'].includes(s.status ?? '')
    ).length;

    // Intensität = Stopps pro Stunde
    const stundenAktiv = Math.max(0.5, schichtDauerMin / 60);
    const stoppsProH = stoppsAbge / stundenAktiv;
    const intensitaet: EnergiePrognose['intensitaet'] =
      stoppsProH >= 6 ? 'hoch' : stoppsProH >= 3 ? 'mittel' : 'niedrig';

    // Energie-Modell: Start 100%, Verbrauch je nach Intensität + Schichtdauer
    const verbrauchProMin = intensitaet === 'hoch' ? 0.28 : intensitaet === 'mittel' ? 0.20 : 0.12;
    const energie = Math.max(5, Math.round(100 - schichtDauerMin * verbrauchProMin));

    // Restdauer bis Energie <20%
    const restMin = energie > 20
      ? Math.round((energie - 20) / verbrauchProMin)
      : 0;

    // Pause-Empfehlung: bei hoher Intensität nach 90 Min oder wenn Energie <50
    const pauseEmpfohlen = energie < 45 || (intensitaet === 'hoch' && schichtDauerMin > 90);
    const pauseInMin: number | null = pauseEmpfohlen
      ? (energie < 30 ? 0 : Math.round(Math.max(0, (50 - energie) / verbrauchProMin)))
      : null;

    let empfehlung = 'Energie stabil — weiter so!';
    if (energie < 30) {
      empfehlung = 'Dringend: Kurze Pause jetzt — Konzentration und Sicherheit wichtig!';
    } else if (pauseEmpfohlen && pauseInMin !== null && pauseInMin > 0) {
      empfehlung = `In ~${pauseInMin} Min kurze Pause (10 Min) empfohlen — danach stabile Energie bis Schichtende.`;
    } else if (pauseEmpfohlen) {
      empfehlung = 'Kurze Pause (10 Min) empfohlen — du bist schon lange unterwegs!';
    } else if (intensitaet === 'hoch') {
      empfehlung = 'Hohe Intensität — bleib gut hydriert!';
    }

    return NextResponse.json({
      energie_pct: energie,
      schicht_dauer_min: schichtDauerMin,
      stopps_absolviert: stoppsAbge,
      intensitaet,
      pause_empfohlen: pauseEmpfohlen,
      pause_in_min: pauseInMin,
      prognose_restdauer_min: restMin,
      empfehlung,
      generiert_am: now.toISOString(),
    } satisfies EnergiePrognose);
  } catch {
    return NextResponse.json(buildMock());
  }
}
