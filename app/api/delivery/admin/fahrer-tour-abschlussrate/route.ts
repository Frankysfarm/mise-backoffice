/**
 * GET /api/delivery/admin/fahrer-tour-abschlussrate?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2792 — Fahrer-Tour-Abschlussrate-API
 * Abgeschlossene Touren / Zugewiesene Touren je Fahrer heute in mise_delivery_batches
 * (status = completed vs. cancelled/failed).
 * Ampel grün(≥95%)/gelb(80–94%)/rot(<80%);
 * Alert <80% "Niedrige Abschlussrate!"; Trend vs. gestern; driver_id-Modus;
 * Multi-Tenant; Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Ampel2792 = 'gruen' | 'gelb' | 'rot';
export type Trend2792 = 'steigend' | 'fallend' | 'stabil';

export interface FahrerAbschlussrate {
  fahrer_id: string;
  fahrer_name: string;
  rate_pct: number;
  abgeschlossen: number;
  gesamt: number;
  ampel: Ampel2792;
  trend: Trend2792;
  trend_delta: number;
  gestern_rate_pct: number;
  alert: boolean;
  rang: number;
}

export interface AbschlussrateResponse {
  location_id: string;
  fahrer: FahrerAbschlussrate[];
  team_avg_pct: number;
  alert_count: number;
  generiert_am: string;
}

const ZIEL_PCT = 95;
const WARN_PCT = 80;

function ampelVon(pct: number): Ampel2792 {
  if (pct >= ZIEL_PCT) return 'gruen';
  if (pct >= WARN_PCT) return 'gelb';
  return 'rot';
}

function trendVon(heute: number, gestern: number): { trend: Trend2792; delta: number } {
  const delta = Math.round((heute - gestern) * 10) / 10;
  if (delta > 2) return { trend: 'steigend', delta };
  if (delta < -2) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER = [
  { fahrer_id: 'mock-f1', fahrer_name: 'Max Müller',  rate_pct: 97, abgeschlossen: 11, gesamt: 11, gestern_rate_pct: 95 },
  { fahrer_id: 'mock-f2', fahrer_name: 'Sara Koch',   rate_pct: 88, abgeschlossen:  7, gesamt:  8, gestern_rate_pct: 91 },
  { fahrer_id: 'mock-f3', fahrer_name: 'Tim Weber',   rate_pct: 75, abgeschlossen:  6, gesamt:  8, gestern_rate_pct: 80 },
  { fahrer_id: 'mock-f4', fahrer_name: 'Anna Bauer',  rate_pct: 100, abgeschlossen: 10, gesamt: 10, gestern_rate_pct: 100 },
];

function buildMock(locationId: string, driverId?: string | null): AbschlussrateResponse {
  let src = MOCK_FAHRER;
  if (driverId) src = src.filter(f => f.fahrer_id === driverId);
  const sorted = [...src].sort((a, b) => b.rate_pct - a.rate_pct);
  const fahrer: FahrerAbschlussrate[] = sorted.map((f, i) => {
    const { trend, delta } = trendVon(f.rate_pct, f.gestern_rate_pct);
    return {
      ...f,
      ampel: ampelVon(f.rate_pct),
      trend,
      trend_delta: delta,
      alert: f.rate_pct < WARN_PCT,
      rang: i + 1,
    };
  });
  const team_avg_pct =
    fahrer.length > 0
      ? Math.round((fahrer.reduce((s, f) => s + f.rate_pct, 0) / fahrer.length) * 10) / 10
      : 0;
  return {
    location_id: locationId,
    fahrer,
    team_avg_pct,
    alert_count: fahrer.filter(f => f.alert).length,
    generiert_am: new Date().toISOString(),
  };
}

type BatchRow = {
  driver_id: string | null;
  status: string | null;
};

function calcRate(batches: BatchRow[]): { rate_pct: number; abgeschlossen: number; gesamt: number } {
  const gesamt = batches.length;
  if (gesamt === 0) return { rate_pct: 100, abgeschlossen: 0, gesamt: 0 };
  const abgeschlossen = batches.filter(b => b.status === 'completed').length;
  const rate_pct = Math.round((abgeschlossen / gesamt) * 1000) / 10;
  return { rate_pct, abgeschlossen, gesamt };
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
      .select('driver_id, status')
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString())
      .in('status', ['completed', 'cancelled', 'failed']);

    const { data: batchesGestern } = await sb
      .from('mise_delivery_batches')
      .select('driver_id, status')
      .eq('location_id', locationId)
      .gte('created_at', gestStart.toISOString())
      .lt('created_at', gestEnd.toISOString())
      .in('status', ['completed', 'cancelled', 'failed']);

    const todayRows  = (batchesToday  ?? []) as BatchRow[];
    const gestRows   = (batchesGestern ?? []) as BatchRow[];

    const unsorted = filteredDrivers.map((d: Driver) => {
      const mine      = todayRows.filter(b => b.driver_id === d.id);
      const meineGest = gestRows.filter(b => b.driver_id === d.id);
      const { rate_pct, abgeschlossen, gesamt } = calcRate(mine);
      const { rate_pct: gestern_rate_pct } = calcRate(meineGest);
      const { trend, delta } = trendVon(rate_pct, gestern_rate_pct);
      return {
        fahrer_id: d.id,
        fahrer_name: d.full_name ?? 'Fahrer',
        rate_pct,
        abgeschlossen,
        gesamt,
        ampel: ampelVon(rate_pct),
        trend,
        trend_delta: delta,
        alert: rate_pct < WARN_PCT,
        gestern_rate_pct,
      };
    });

    const sorted = [...unsorted].sort((a, b) => b.rate_pct - a.rate_pct);
    const fahrer: FahrerAbschlussrate[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));

    const team_avg_pct =
      fahrer.length > 0
        ? Math.round((fahrer.reduce((s, f) => s + f.rate_pct, 0) / fahrer.length) * 10) / 10
        : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_avg_pct,
      alert_count: fahrer.filter(f => f.alert).length,
      generiert_am: now.toISOString(),
    } satisfies AbschlussrateResponse);
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
