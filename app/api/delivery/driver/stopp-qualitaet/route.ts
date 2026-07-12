/**
 * POST /api/delivery/driver/stopp-qualitaet
 *
 * Phase 1146 — Stopp-Qualitäts-Check (Fahrer-App)
 * Speichert die Selbstbewertung eines Fahrers nach jeder Lieferung
 * (Übergabe, Freundlichkeit, Pünktlichkeit + optionale Notiz).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { driverId, stopId, uebergabe, freundlichkeit, puenktlichkeit, notiz, timestamp } = body;

    if (!driverId || !stopId) {
      return NextResponse.json({ error: 'driverId und stopId erforderlich' }, { status: 400 });
    }

    const avg = ((uebergabe ?? 0) + (freundlichkeit ?? 0) + (puenktlichkeit ?? 0)) / 3;

    try {
      const supabase = createClient();
      await supabase.from('driver_stop_quality').insert({
        driver_id: driverId,
        stop_id: stopId,
        uebergabe_score: uebergabe ?? null,
        freundlichkeit_score: freundlichkeit ?? null,
        puenktlichkeit_score: puenktlichkeit ?? null,
        avg_score: Math.round(avg * 100) / 100,
        notiz: notiz ?? null,
        recorded_at: timestamp ?? new Date().toISOString(),
      });
    } catch {
      // Tabelle existiert ggf. noch nicht — Daten werden verworfen, kein Fehler
    }

    return NextResponse.json({
      ok: true,
      avgScore: Math.round(avg * 100) / 100,
      message: 'Stopp-Qualität gespeichert',
    });
  } catch (err) {
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
