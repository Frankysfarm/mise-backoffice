/**
 * GET /api/delivery/admin/fahrer-erstkontakt-zeit?location_id=<uuid>
 *
 * Phase 2619 — Fahrer-Erstkontakt-Zeit-API
 * Ø Zeit vom Schichtbeginn bis zur ersten Lieferung je Fahrer heute in Min.
 * Ampel grün(≤10)/gelb(11–20)/rot(>20); Alert >20 Min; Trend vs. gestern; Multi-Tenant; Supabase+Mock.
 *
 * Response: { location_id, fahrer: FahrerErstkontaktZeit[], team_durchschnitt, alert_count, generiert_am }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Ampel = 'gruen' | 'gelb' | 'rot';
export type Trend = 'steigend' | 'fallend' | 'stabil';

export interface FahrerErstkontaktZeit {
  fahrer_id: string;
  fahrer_name: string;
  erstkontakt_min: number;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  rang: number;
}

export interface FahrerErstkontaktZeitAntwort {
  location_id: string;
  fahrer: FahrerErstkontaktZeit[];
  team_durchschnitt: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(min: number): Ampel {
  if (min <= 10) return 'gruen';
  if (min <= 20) return 'gelb';
  return 'rot';
}

function trendVon(heute: number, gestern: number): { trend: Trend; delta: number } {
  const delta = Math.round((heute - gestern) * 10) / 10;
  if (delta > 1)  return { trend: 'steigend', delta };
  if (delta < -1) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER: Omit<FahrerErstkontaktZeit, 'rang'>[] = [
  { fahrer_id: 'mock-f1', fahrer_name: 'Max Müller',  erstkontakt_min: 8,  trend: 'fallend',  trend_delta: -2, ampel: 'gruen' },
  { fahrer_id: 'mock-f2', fahrer_name: 'Sarah K.',    erstkontakt_min: 12, trend: 'stabil',   trend_delta:  1, ampel: 'gelb'  },
  { fahrer_id: 'mock-f3', fahrer_name: 'Lena S.',     erstkontakt_min: 9,  trend: 'fallend',  trend_delta: -3, ampel: 'gruen' },
  { fahrer_id: 'mock-f4', fahrer_name: 'Tom B.',      erstkontakt_min: 25, trend: 'steigend', trend_delta:  5, ampel: 'rot'   },
  { fahrer_id: 'mock-f5', fahrer_name: 'Jana F.',     erstkontakt_min: 18, trend: 'stabil',   trend_delta:  0, ampel: 'gelb'  },
];

function mockAntwort(locationId: string): FahrerErstkontaktZeitAntwort {
  const fahrer: FahrerErstkontaktZeit[] = MOCK_FAHRER
    .sort((a, b) => b.erstkontakt_min - a.erstkontakt_min)
    .map((f, i) => ({ ...f, rang: i + 1 }));
  const team_durchschnitt =
    Math.round((fahrer.reduce((s, f) => s + f.erstkontakt_min, 0) / fahrer.length) * 10) / 10;
  return {
    location_id: locationId,
    fahrer,
    team_durchschnitt,
    alert_count: fahrer.filter(f => f.ampel === 'rot').length,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id') ?? '';
  const driverId   = req.nextUrl.searchParams.get('driver_id');

  if (!locationId) {
    return NextResponse.json(mockAntwort('mock'), { status: 200 });
  }

  try {
    const supabase = await createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Get today's tours with driver and timing info
    const { data: toursHeute } = await supabase
      .from('delivery_tours')
      .select('driver_id, started_at, driver_name, created_at')
      .eq('location_id', locationId)
      .gte('created_at', today.toISOString())
      .not('started_at', 'is', null)
      .order('driver_id');

    // Get yesterday's tours for trend
    const { data: toursGestern } = await supabase
      .from('delivery_tours')
      .select('driver_id, started_at, created_at')
      .eq('location_id', locationId)
      .gte('created_at', yesterday.toISOString())
      .lt('created_at', today.toISOString())
      .not('started_at', 'is', null)
      .order('driver_id');

    if (!toursHeute || toursHeute.length === 0) {
      return NextResponse.json(mockAntwort(locationId), { status: 200 });
    }

    // Group by driver, take first started_at per driver
    const driverMapHeute = new Map<string, { name: string; first_min: number }>();
    for (const t of toursHeute) {
      if (!t.driver_id || !t.started_at || !t.created_at) continue;
      const loginTime  = new Date(t.created_at).getTime();
      const firstDelivery = new Date(t.started_at).getTime();
      const diffMin = Math.max(0, Math.round((firstDelivery - loginTime) / 60000));
      const existing = driverMapHeute.get(t.driver_id);
      if (!existing || diffMin < existing.first_min) {
        driverMapHeute.set(t.driver_id, { name: t.driver_name ?? t.driver_id, first_min: diffMin });
      }
    }

    const driverMapGestern = new Map<string, number>();
    for (const t of (toursGestern ?? [])) {
      if (!t.driver_id || !t.started_at || !t.created_at) continue;
      const loginTime  = new Date(t.created_at).getTime();
      const firstDelivery = new Date(t.started_at).getTime();
      const diffMin = Math.max(0, Math.round((firstDelivery - loginTime) / 60000));
      const existing = driverMapGestern.get(t.driver_id);
      if (existing === undefined || diffMin < existing) {
        driverMapGestern.set(t.driver_id, diffMin);
      }
    }

    let entries = Array.from(driverMapHeute.entries()).map(([id, { name, first_min }]) => {
      const gesternMin = driverMapGestern.get(id) ?? first_min;
      const { trend, delta } = trendVon(first_min, gesternMin);
      return {
        fahrer_id: id,
        fahrer_name: name,
        erstkontakt_min: first_min,
        trend,
        trend_delta: delta,
        ampel: ampelVon(first_min),
        rang: 0,
      };
    });

    if (driverId) {
      entries = entries.filter(e => e.fahrer_id === driverId);
    }

    entries.sort((a, b) => b.erstkontakt_min - a.erstkontakt_min);
    entries.forEach((e, i) => { e.rang = i + 1; });

    const team_durchschnitt = entries.length > 0
      ? Math.round((entries.reduce((s, e) => s + e.erstkontakt_min, 0) / entries.length) * 10) / 10
      : 0;

    const resp: FahrerErstkontaktZeitAntwort = {
      location_id: locationId,
      fahrer: entries,
      team_durchschnitt,
      alert_count: entries.filter(e => e.ampel === 'rot').length,
      generiert_am: new Date().toISOString(),
    };

    return NextResponse.json(resp, { status: 200 });
  } catch {
    return NextResponse.json(mockAntwort(locationId), { status: 200 });
  }
}
