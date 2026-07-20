/**
 * GET /api/delivery/admin/fahrer-reaktionszeit-auf-zuweisung?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2786 — Fahrer-Reaktionszeit-auf-Zuweisung-API
 * Ø Zeit (Min) von Batch-Zuweisung (created_at) bis Fahrerannahme (accepted_at)
 * in mise_delivery_batches je Fahrer heute.
 * Ampel grün(≤2 Min)/gelb(2–5 Min)/rot(>5 Min);
 * Alert >5 Min "Langsame Reaktion!"; Trend vs. gestern; driver_id-Modus;
 * Multi-Tenant; Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Ampel2786 = 'gruen' | 'gelb' | 'rot';
export type Trend2786 = 'steigend' | 'fallend' | 'stabil';

export interface FahrerReaktionszeitZuweisung {
  fahrer_id: string;
  fahrer_name: string;
  avg_min: number;
  batches_heute: number;
  ampel: Ampel2786;
  trend: Trend2786;
  trend_delta: number;
  gestern_avg_min: number;
  alert: boolean;
  rang: number;
}

export interface ReaktionszeitZuweisungResponse {
  location_id: string;
  fahrer: FahrerReaktionszeitZuweisung[];
  team_avg_min: number;
  alert_count: number;
  generiert_am: string;
}

const ZIEL_MIN = 2;
const WARN_MIN = 5;

function ampelVon(avg: number): Ampel2786 {
  if (avg <= ZIEL_MIN) return 'gruen';
  if (avg <= WARN_MIN) return 'gelb';
  return 'rot';
}

function trendVon(heute: number, gestern: number): { trend: Trend2786; delta: number } {
  const delta = Math.round((heute - gestern) * 10) / 10;
  if (delta < -0.3) return { trend: 'fallend', delta };
  if (delta > 0.3) return { trend: 'steigend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER = [
  { fahrer_id: 'mock-f1', fahrer_name: 'Max Müller',  avg_min: 1.4, batches_heute: 11, gestern_avg_min: 1.8 },
  { fahrer_id: 'mock-f2', fahrer_name: 'Sara Koch',   avg_min: 3.2, batches_heute:  8, gestern_avg_min: 2.9 },
  { fahrer_id: 'mock-f3', fahrer_name: 'Tim Weber',   avg_min: 6.5, batches_heute:  6, gestern_avg_min: 5.8 },
  { fahrer_id: 'mock-f4', fahrer_name: 'Anna Bauer',  avg_min: 2.1, batches_heute: 10, gestern_avg_min: 2.3 },
];

function buildMock(locationId: string, driverId?: string | null): ReaktionszeitZuweisungResponse {
  let src = MOCK_FAHRER;
  if (driverId) src = src.filter(f => f.fahrer_id === driverId);
  const sorted = [...src].sort((a, b) => a.avg_min - b.avg_min);
  const fahrer: FahrerReaktionszeitZuweisung[] = sorted.map((f, i) => {
    const { trend, delta } = trendVon(f.avg_min, f.gestern_avg_min);
    return {
      ...f,
      ampel: ampelVon(f.avg_min),
      trend,
      trend_delta: delta,
      alert: f.avg_min > WARN_MIN,
      rang: i + 1,
    };
  });
  const team_avg_min =
    fahrer.length > 0
      ? Math.round((fahrer.reduce((s, f) => s + f.avg_min, 0) / fahrer.length) * 10) / 10
      : 0;
  return {
    location_id: locationId,
    fahrer,
    team_avg_min,
    alert_count: fahrer.filter(f => f.alert).length,
    generiert_am: new Date().toISOString(),
  };
}

type BatchRow = {
  driver_id: string | null;
  created_at: string | null;
  accepted_at: string | null;
};

function avgReaktionszeit(batches: BatchRow[]): number {
  const valid = batches.filter(b => b.created_at && b.accepted_at);
  if (valid.length === 0) return 3.0;
  const total = valid.reduce((s, b) => {
    const diff =
      (new Date(b.accepted_at!).getTime() - new Date(b.created_at!).getTime()) / 60_000;
    return s + Math.max(0, diff);
  }, 0);
  return Math.round((total / valid.length) * 10) / 10;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();
    const now = new Date();

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const gestStart = new Date(todayStart.getTime() - 86_400_000);
    const gestEnd   = todayStart;

    const { data: drivers, error: dErr } = await sb
      .from('mise_drivers')
      .select('id, full_name')
      .eq('location_id', locationId)
      .in('status', ['online', 'busy', 'delivering', 'returning', 'active']);

    if (dErr || !drivers || drivers.length === 0) {
      return NextResponse.json(buildMock(locationId, driverId));
    }

    type Driver = { id: string; full_name: string | null };
    const filteredDrivers = driverId
      ? (drivers as Driver[]).filter(d => d.id === driverId)
      : (drivers as Driver[]);

    const { data: batchesToday } = await sb
      .from('mise_delivery_batches')
      .select('driver_id, created_at, accepted_at')
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString())
      .not('accepted_at', 'is', null);

    const { data: batchesGestern } = await sb
      .from('mise_delivery_batches')
      .select('driver_id, created_at, accepted_at')
      .eq('location_id', locationId)
      .gte('created_at', gestStart.toISOString())
      .lt('created_at', gestEnd.toISOString())
      .not('accepted_at', 'is', null);

    const todayRows  = (batchesToday  ?? []) as BatchRow[];
    const gestRows   = (batchesGestern ?? []) as BatchRow[];

    const unsorted = filteredDrivers.map((d: Driver) => {
      const mine       = todayRows.filter(b => b.driver_id === d.id);
      const meineGest  = gestRows.filter(b => b.driver_id === d.id);
      const avg_min         = avgReaktionszeit(mine);
      const gestern_avg_min = avgReaktionszeit(meineGest);
      const { trend, delta } = trendVon(avg_min, gestern_avg_min);
      return {
        fahrer_id: d.id,
        fahrer_name: d.full_name ?? 'Fahrer',
        avg_min,
        batches_heute: mine.filter(b => b.created_at && b.accepted_at).length,
        ampel: ampelVon(avg_min),
        trend,
        trend_delta: delta,
        alert: avg_min > WARN_MIN,
        gestern_avg_min,
      };
    });

    const sorted = [...unsorted].sort((a, b) => a.avg_min - b.avg_min);
    const fahrer: FahrerReaktionszeitZuweisung[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));

    const team_avg_min =
      fahrer.length > 0
        ? Math.round((fahrer.reduce((s, f) => s + f.avg_min, 0) / fahrer.length) * 10) / 10
        : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_avg_min,
      alert_count: fahrer.filter(f => f.alert).length,
      generiert_am: now.toISOString(),
    } satisfies ReaktionszeitZuweisungResponse);
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
