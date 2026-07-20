/**
 * GET /api/delivery/admin/fahrer-puenktlichkeitsrate?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2802 — Fahrer-Pünktlichkeitsrate-API
 * Anteil pünktlicher Lieferungen (delivered_at ≤ promised_time) je Fahrer heute.
 * Ampel grün(≥90%)/gelb(70–89%)/rot(<70%);
 * Alert <70% "Niedrige Pünktlichkeit!"; Trend vs. gestern; driver_id-Modus;
 * Multi-Tenant; Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Ampel2802 = 'gruen' | 'gelb' | 'rot';
export type Trend2802 = 'steigend' | 'fallend' | 'stabil';

export interface FahrerPuenktlichkeit {
  fahrer_id: string;
  fahrer_name: string;
  puenktlich_rate: number;
  puenktlich_anzahl: number;
  gesamt_lieferungen: number;
  ampel: Ampel2802;
  trend: Trend2802;
  trend_delta: number;
  gestern_rate: number;
  alert: boolean;
  rang: number;
}

export interface PuenktlichkeitsrateResponse {
  location_id: string;
  fahrer: FahrerPuenktlichkeit[];
  team_avg_rate: number;
  alert_count: number;
  generiert_am: string;
}

const ZIEL_RATE = 90;
const WARN_RATE = 70;

function ampelVon(rate: number): Ampel2802 {
  if (rate >= ZIEL_RATE) return 'gruen';
  if (rate >= WARN_RATE) return 'gelb';
  return 'rot';
}

function trendVon(heute: number, gestern: number): { trend: Trend2802; delta: number } {
  const delta = Math.round((heute - gestern) * 10) / 10;
  if (delta > 1) return { trend: 'steigend', delta };
  if (delta < -1) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER = [
  { fahrer_id: 'mock-f1', fahrer_name: 'Max Müller',  puenktlich_rate: 95.5, puenktlich_anzahl: 21, gesamt_lieferungen: 22, gestern_rate: 93.0 },
  { fahrer_id: 'mock-f2', fahrer_name: 'Sara Koch',   puenktlich_rate: 81.3, puenktlich_anzahl: 13, gesamt_lieferungen: 16, gestern_rate: 83.5 },
  { fahrer_id: 'mock-f3', fahrer_name: 'Tim Weber',   puenktlich_rate: 62.5, puenktlich_anzahl:  5, gesamt_lieferungen:  8, gestern_rate: 68.0 },
  { fahrer_id: 'mock-f4', fahrer_name: 'Anna Bauer',  puenktlich_rate: 100.0, puenktlich_anzahl: 10, gesamt_lieferungen: 10, gestern_rate: 97.0 },
];

function buildMock(locationId: string, driverId?: string | null): PuenktlichkeitsrateResponse {
  let src = MOCK_FAHRER;
  if (driverId) src = src.filter(f => f.fahrer_id === driverId);
  const sorted = [...src].sort((a, b) => b.puenktlich_rate - a.puenktlich_rate);
  const fahrer: FahrerPuenktlichkeit[] = sorted.map((f, i) => {
    const { trend, delta } = trendVon(f.puenktlich_rate, f.gestern_rate);
    return {
      ...f,
      ampel: ampelVon(f.puenktlich_rate),
      trend,
      trend_delta: delta,
      alert: f.puenktlich_rate < WARN_RATE,
      rang: i + 1,
    };
  });
  const team_avg_rate =
    fahrer.length > 0
      ? Math.round((fahrer.reduce((s, f) => s + f.puenktlich_rate, 0) / fahrer.length) * 10) / 10
      : 0;
  return {
    location_id: locationId,
    fahrer,
    team_avg_rate,
    alert_count: fahrer.filter(f => f.alert).length,
    generiert_am: new Date().toISOString(),
  };
}

type BatchRow = {
  driver_id: string | null;
  delivered_at: string | null;
  promised_time: string | null;
  status: string | null;
};

function calcRate(batches: BatchRow[]): { rate: number; puenktlich: number; gesamt: number } {
  const delivered = batches.filter(b => b.status === 'completed' && b.delivered_at);
  if (delivered.length === 0) return { rate: 0, puenktlich: 0, gesamt: 0 };
  const puenktlich = delivered.filter(b => {
    if (!b.delivered_at || !b.promised_time) return false;
    return new Date(b.delivered_at) <= new Date(b.promised_time);
  }).length;
  const rate = Math.round((puenktlich / delivered.length) * 1000) / 10;
  return { rate, puenktlich, gesamt: delivered.length };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb  = await createClient();
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
      .select('driver_id, delivered_at, promised_time, status')
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString());

    const { data: batchesGestern } = await sb
      .from('mise_delivery_batches')
      .select('driver_id, delivered_at, promised_time, status')
      .eq('location_id', locationId)
      .gte('created_at', gestStart.toISOString())
      .lt('created_at', gestEnd.toISOString());

    const todayRows = (batchesToday  ?? []) as BatchRow[];
    const gestRows  = (batchesGestern ?? []) as BatchRow[];

    const unsorted = filteredDrivers.map((d: Driver) => {
      const mine      = todayRows.filter(b => b.driver_id === d.id);
      const meineGest = gestRows.filter(b => b.driver_id === d.id);
      const { rate, puenktlich, gesamt } = calcRate(mine);
      const { rate: gestern_rate }       = calcRate(meineGest);
      const { trend, delta } = trendVon(rate, gestern_rate);
      return {
        fahrer_id: d.id,
        fahrer_name: d.full_name ?? 'Fahrer',
        puenktlich_rate: rate,
        puenktlich_anzahl: puenktlich,
        gesamt_lieferungen: gesamt,
        ampel: ampelVon(rate),
        trend,
        trend_delta: delta,
        alert: rate < WARN_RATE,
        gestern_rate,
      };
    });

    const sorted = [...unsorted].sort((a, b) => b.puenktlich_rate - a.puenktlich_rate);
    const fahrer: FahrerPuenktlichkeit[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));

    const team_avg_rate =
      fahrer.length > 0
        ? Math.round((fahrer.reduce((s, f) => s + f.puenktlich_rate, 0) / fahrer.length) * 10) / 10
        : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_avg_rate,
      alert_count: fahrer.filter(f => f.alert).length,
      generiert_am: now.toISOString(),
    } satisfies PuenktlichkeitsrateResponse);
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
