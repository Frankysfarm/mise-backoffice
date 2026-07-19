/**
 * GET /api/delivery/admin/fahrer-umsatz?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2507 — Fahrer-Umsatz-Beitrag-API
 * Umsatz (€) je Fahrer heute aus abgeschlossenen Touren; Trend vs. Vorwoche;
 * Alert wenn <100€; Ampel; Multi-Tenant; Supabase+Mock.
 *
 * Response: { location_id, fahrer, team_total_euro, team_avg_euro, alert_count, generiert_am }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type AmpelUmsatz = 'gruen' | 'gelb' | 'rot';
export type TrendUmsatz = 'steigend' | 'fallend' | 'stabil';

export interface FahrerUmsatz {
  fahrer_id: string;
  fahrer_name: string;
  umsatz_euro: number;
  umsatz_vorwoche: number | null;
  touren_heute: number;
  trend: TrendUmsatz;
  trend_delta: number;
  ampel: AmpelUmsatz;
  rang: number;
}

export interface FahrerUmsatzAntwort {
  location_id: string;
  fahrer: FahrerUmsatz[];
  team_total_euro: number;
  team_avg_euro: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(euro: number): AmpelUmsatz {
  if (euro >= 200) return 'gruen';
  if (euro >= 100) return 'gelb';
  return 'rot';
}

function trendVon(heute: number, vorwoche: number | null): { trend: TrendUmsatz; delta: number } {
  if (vorwoche === null || vorwoche === 0) return { trend: 'stabil', delta: 0 };
  const delta = Math.round(heute - vorwoche);
  if (delta > 10) return { trend: 'steigend', delta };
  if (delta < -10) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER: Omit<FahrerUmsatz, 'rang'>[] = [
  {
    fahrer_id: 'mock-f1',
    fahrer_name: 'Max Müller',
    umsatz_euro: 287.50,
    umsatz_vorwoche: 265.00,
    touren_heute: 8,
    trend: 'steigend',
    trend_delta: 22,
    ampel: 'gruen',
  },
  {
    fahrer_id: 'mock-f2',
    fahrer_name: 'Sara Koch',
    umsatz_euro: 154.80,
    umsatz_vorwoche: 162.30,
    touren_heute: 5,
    trend: 'stabil',
    trend_delta: -7,
    ampel: 'gelb',
  },
  {
    fahrer_id: 'mock-f3',
    fahrer_name: 'Tim Becker',
    umsatz_euro: 78.20,
    umsatz_vorwoche: 95.40,
    touren_heute: 3,
    trend: 'fallend',
    trend_delta: -17,
    ampel: 'rot',
  },
  {
    fahrer_id: 'mock-f4',
    fahrer_name: 'Julia Fischer',
    umsatz_euro: 231.00,
    umsatz_vorwoche: 210.50,
    touren_heute: 7,
    trend: 'steigend',
    trend_delta: 20,
    ampel: 'gruen',
  },
];

function buildMock(locationId: string, driverId?: string): FahrerUmsatzAntwort {
  const liste = driverId
    ? MOCK_FAHRER.filter((f) => f.fahrer_id === driverId)
    : MOCK_FAHRER;
  const ranked: FahrerUmsatz[] = [...liste]
    .sort((a, b) => b.umsatz_euro - a.umsatz_euro)
    .map((f, i) => ({ ...f, rang: i + 1 }));
  const total = Math.round(ranked.reduce((s, f) => s + f.umsatz_euro, 0) * 100) / 100;
  const avg = ranked.length > 0 ? Math.round((total / ranked.length) * 100) / 100 : 0;
  return {
    location_id: locationId,
    fahrer: ranked,
    team_total_euro: total,
    team_avg_euro: avg,
    alert_count: ranked.filter((f) => f.ampel === 'rot').length,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const locationId = searchParams.get('location_id') ?? '';
  const driverId = searchParams.get('driver_id') ?? undefined;

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();

    let driversQ = sb
      .from('employees')
      .select('id, full_name')
      .eq('role', 'driver')
      .eq('location_id', locationId);
    if (driverId) driversQ = driversQ.eq('id', driverId);
    const { data: drivers, error: driversErr } = await driversQ;

    if (driversErr || !drivers || drivers.length === 0) throw new Error('no_drivers');

    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString().slice(0, 10);
    const weekAgoEnd = new Date(Date.now() - 6 * 24 * 3600_000).toISOString().slice(0, 10);

    const [{ data: batchesToday }, { data: batchesVorwoche }] = await Promise.all([
      sb
        .from('mise_delivery_batches')
        .select('driver_id, total_amount, order_count')
        .eq('location_id', locationId)
        .eq('status', 'completed')
        .gte('created_at', `${today}T00:00:00`),
      sb
        .from('mise_delivery_batches')
        .select('driver_id, total_amount, order_count')
        .eq('location_id', locationId)
        .eq('status', 'completed')
        .gte('created_at', `${weekAgo}T00:00:00`)
        .lt('created_at', `${weekAgoEnd}T00:00:00`),
    ]);

    const fahrerListe: Omit<FahrerUmsatz, 'rang'>[] = (
      drivers as { id: string; full_name: string | null }[]
    ).map((d) => {
      const mine = (batchesToday ?? []).filter((b) => b.driver_id === d.id);
      const umsatz_euro =
        Math.round(
          mine.reduce((s, b) => s + ((b.total_amount as number | null) ?? 0), 0) * 100
        ) / 100;
      const touren_heute = mine.length;

      const vw = (batchesVorwoche ?? []).filter((b) => b.driver_id === d.id);
      const umsatz_vorwoche =
        vw.length > 0
          ? Math.round(
              vw.reduce((s, b) => s + ((b.total_amount as number | null) ?? 0), 0) * 100
            ) / 100
          : null;

      const { trend, delta } = trendVon(umsatz_euro, umsatz_vorwoche);

      return {
        fahrer_id: d.id,
        fahrer_name: d.full_name ?? 'Fahrer',
        umsatz_euro,
        umsatz_vorwoche,
        touren_heute,
        trend,
        trend_delta: delta,
        ampel: ampelVon(umsatz_euro),
      };
    });

    const aktive = fahrerListe.filter((f) => f.umsatz_euro > 0);
    const sorted = [...aktive].sort((a, b) => b.umsatz_euro - a.umsatz_euro);
    const ranked: FahrerUmsatz[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));

    if (ranked.length === 0) throw new Error('no_active_drivers');

    const team_total_euro =
      Math.round(ranked.reduce((s, f) => s + f.umsatz_euro, 0) * 100) / 100;
    const team_avg_euro =
      ranked.length > 0
        ? Math.round((team_total_euro / ranked.length) * 100) / 100
        : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer: ranked,
      team_total_euro,
      team_avg_euro,
      alert_count: ranked.filter((f) => f.ampel === 'rot').length,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerUmsatzAntwort);
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
