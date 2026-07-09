/**
 * GET /api/delivery/driver/schicht-energie?driver_id=<uuid>
 *
 * Phase 949 — Schicht-Energie-API (Fahrer-App)
 * Energie-Niveau basierend auf Schichtdauer, Stopps und Pausen.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface EnergieData {
  energie_pct: number;
  schicht_stunden: number;
  stopps_heute: number;
  pausen_min: number;
  empfehlung: string | null;
  status: 'fit' | 'muede' | 'erschoepft';
}

function mockData(): EnergieData {
  return {
    energie_pct: 72,
    schicht_stunden: 4.5,
    stopps_heute: 14,
    pausen_min: 20,
    empfehlung: 'Kurze Pause nach dem nächsten Stopp empfohlen.',
    status: 'fit',
  };
}

function berechneEnergie(schichtMin: number, stopps: number, pausenMin: number): EnergieData['status'] {
  const erschoepfungScore = (schichtMin / 60) * 15 + stopps * 2 - pausenMin * 0.5;
  if (erschoepfungScore > 80) return 'erschoepft';
  if (erschoepfungScore > 40) return 'muede';
  return 'fit';
}

function empfehlung(status: EnergieData['status'], pausenMin: number, schichtMin: number): string | null {
  if (status === 'erschoepft') return 'Dringend: Mindestens 15 Min Pause einlegen!';
  if (status === 'muede') {
    if (pausenMin < 10) return 'Kurze Pause empfohlen — du hast heute noch wenig Pause gemacht.';
    return 'Kurze Pause nach dem nächsten Stopp empfohlen.';
  }
  if (schichtMin > 240 && pausenMin < 20) return 'Gute Energie — nach 4h Schicht trotzdem kurz Pause gönnen.';
  return null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const driverId = url.searchParams.get('driver_id');
  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  try {
    const sb = await createClient();
    const heute = new Date();
    heute.setHours(0, 0, 0, 0);

    const [{ data: shift }, { data: stops }, { data: pausen }] = await Promise.all([
      sb
        .from('driver_shifts')
        .select('actual_start, actual_end')
        .eq('driver_id', driverId)
        .eq('status', 'active')
        .order('actual_start', { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb
        .from('mise_delivery_stops')
        .select('id')
        .eq('driver_id', driverId)
        .gte('created_at', heute.toISOString()),
      sb
        .from('driver_pauses')
        .select('start_at, end_at')
        .eq('driver_id', driverId)
        .gte('start_at', heute.toISOString()),
    ]);

    if (!shift) return NextResponse.json(mockData());

    const shiftData = shift as { actual_start: string | null; actual_end: string | null };
    const now = Date.now();
    const startMs = shiftData.actual_start ? new Date(shiftData.actual_start).getTime() : now;
    const schichtMin = Math.round((now - startMs) / 60_000);
    const schichtStunden = Math.round((schichtMin / 60) * 10) / 10;

    const stoppsHeute = stops?.length ?? 0;

    const pausenMin = (pausen ?? []).reduce((sum, p) => {
      const pData = p as { start_at: string; end_at: string | null };
      if (!pData.end_at) return sum;
      return sum + (new Date(pData.end_at).getTime() - new Date(pData.start_at).getTime()) / 60_000;
    }, 0);

    const status = berechneEnergie(schichtMin, stoppsHeute, pausenMin);

    // 100% Energie bei 0h, sinkt mit Schichtdauer und Arbeitslast, steigt mit Pausen
    const base = Math.max(0, 100 - schichtMin * 0.25 - stoppsHeute * 1.5 + pausenMin * 0.8);
    const energie_pct = Math.max(5, Math.min(100, Math.round(base)));

    const result: EnergieData = {
      energie_pct,
      schicht_stunden: schichtStunden,
      stopps_heute: stoppsHeute,
      pausen_min: Math.round(pausenMin),
      empfehlung: empfehlung(status, pausenMin, schichtMin),
      status,
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(mockData());
  }
}
