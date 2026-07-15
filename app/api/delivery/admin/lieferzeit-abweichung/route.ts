/**
 * GET /api/delivery/admin/lieferzeit-abweichung?location_id=<uuid>
 *
 * Phase 1737 — Lieferzeit-Abweichungs-API (Backend)
 * Δ ETA vs. tatsächlicher Lieferzeit je Tour heute; Ø Abweichung;
 * Ausreißer >10 Min; Multi-Tenant via location_id; Supabase + Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface TourAbweichung {
  tour_id: string;
  driver_id: string;
  fahrer_name: string;
  eta_min: number;
  tatsaechlich_min: number;
  delta_min: number;
  ausreisser: boolean;
}

export interface FahrerAbweichungsProfil {
  driver_id: string;
  fahrer_name: string;
  touren_heute: number;
  avg_delta_min: number;
  ausreisser_anzahl: number;
  alert: boolean;
}

export interface LieferzeitAbweichungResponse {
  touren: TourAbweichung[];
  fahrer: FahrerAbweichungsProfil[];
  gesamt_avg_delta_min: number;
  ausreisser_gesamt: number;
  location_id: string;
  datum: string;
  generiert_am: string;
}

function buildMock(locationId: string): LieferzeitAbweichungResponse {
  const datum = new Date().toISOString().split('T')[0];

  const touren: TourAbweichung[] = [
    { tour_id: 't-1', driver_id: 'drv-1', fahrer_name: 'Mehmet A.', eta_min: 30, tatsaechlich_min: 28, delta_min: -2, ausreisser: false },
    { tour_id: 't-2', driver_id: 'drv-2', fahrer_name: 'Julia S.',  eta_min: 35, tatsaechlich_min: 47, delta_min: 12, ausreisser: true  },
    { tour_id: 't-3', driver_id: 'drv-1', fahrer_name: 'Mehmet A.', eta_min: 28, tatsaechlich_min: 31, delta_min:  3, ausreisser: false },
    { tour_id: 't-4', driver_id: 'drv-3', fahrer_name: 'Kevin R.',  eta_min: 40, tatsaechlich_min: 54, delta_min: 14, ausreisser: true  },
    { tour_id: 't-5', driver_id: 'drv-2', fahrer_name: 'Julia S.',  eta_min: 32, tatsaechlich_min: 35, delta_min:  3, ausreisser: false },
    { tour_id: 't-6', driver_id: 'drv-4', fahrer_name: 'Lena T.',   eta_min: 25, tatsaechlich_min: 26, delta_min:  1, ausreisser: false },
  ];

  const driverMap: Record<string, FahrerAbweichungsProfil> = {};
  for (const t of touren) {
    if (!driverMap[t.driver_id]) {
      driverMap[t.driver_id] = {
        driver_id: t.driver_id,
        fahrer_name: t.fahrer_name,
        touren_heute: 0,
        avg_delta_min: 0,
        ausreisser_anzahl: 0,
        alert: false,
      };
    }
    const p = driverMap[t.driver_id];
    p.touren_heute++;
    p.avg_delta_min += t.delta_min;
    if (t.ausreisser) p.ausreisser_anzahl++;
  }
  const fahrer = Object.values(driverMap).map(p => ({
    ...p,
    avg_delta_min: Math.round((p.avg_delta_min / p.touren_heute) * 10) / 10,
    alert: p.ausreisser_anzahl >= 2 || p.avg_delta_min > 8,
  }));

  const deltas = touren.map(t => t.delta_min);
  const gesamt_avg_delta_min = Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10) / 10;

  return {
    touren,
    fahrer,
    gesamt_avg_delta_min,
    ausreisser_gesamt: touren.filter(t => t.ausreisser).length,
    location_id: locationId,
    datum,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();
    const datum = today.toISOString().split('T')[0];

    const { data: tourData, error } = await supabase
      .from('delivery_tours')
      .select('id, driver_id, fahrer_name, eta_min, started_at, completed_at')
      .eq('location_id', locationId)
      .gte('started_at', todayIso)
      .not('completed_at', 'is', null);

    if (error || !tourData || tourData.length === 0) {
      return NextResponse.json(buildMock(locationId));
    }

    const touren: TourAbweichung[] = tourData
      .filter(t => t.eta_min && t.started_at && t.completed_at)
      .map(t => {
        const startMs = new Date(t.started_at as string).getTime();
        const endMs   = new Date(t.completed_at as string).getTime();
        const tatsaechlich_min = Math.round((endMs - startMs) / 60_000);
        const eta_min = t.eta_min as number;
        const delta_min = tatsaechlich_min - eta_min;
        return {
          tour_id:        t.id as string,
          driver_id:      (t.driver_id as string) ?? 'unknown',
          fahrer_name:    (t.fahrer_name as string) ?? 'Fahrer',
          eta_min,
          tatsaechlich_min,
          delta_min,
          ausreisser: delta_min > 10,
        };
      });

    if (touren.length === 0) return NextResponse.json(buildMock(locationId));

    // Aggregate by driver
    const driverMap: Record<string, { name: string; deltas: number[]; ausreisser: number }> = {};
    for (const t of touren) {
      if (!driverMap[t.driver_id]) driverMap[t.driver_id] = { name: t.fahrer_name, deltas: [], ausreisser: 0 };
      driverMap[t.driver_id].deltas.push(t.delta_min);
      if (t.ausreisser) driverMap[t.driver_id].ausreisser++;
    }

    const fahrer: FahrerAbweichungsProfil[] = Object.entries(driverMap).map(([driver_id, { name, deltas, ausreisser }]) => {
      const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      return {
        driver_id,
        fahrer_name: name,
        touren_heute: deltas.length,
        avg_delta_min: Math.round(avg * 10) / 10,
        ausreisser_anzahl: ausreisser,
        alert: ausreisser >= 2 || avg > 8,
      };
    });

    const allDeltas = touren.map(t => t.delta_min);
    const gesamt_avg_delta_min = Math.round((allDeltas.reduce((a, b) => a + b, 0) / allDeltas.length) * 10) / 10;

    return NextResponse.json({
      touren,
      fahrer,
      gesamt_avg_delta_min,
      ausreisser_gesamt: touren.filter(t => t.ausreisser).length,
      location_id: locationId,
      datum,
      generiert_am: new Date().toISOString(),
    } satisfies LieferzeitAbweichungResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
