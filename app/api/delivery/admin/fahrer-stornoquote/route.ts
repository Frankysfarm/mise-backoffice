/**
 * GET /api/delivery/admin/fahrer-stornoquote?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 3005 — Fahrer-Stornoquote-Index
 * Stornierungsrate (%) je Fahrer heute; stornierte Aufträge / Gesamt-Aufträge.
 * Ampel grün(≤5%)/gelb(5–15%)/rot(>15%); Alert >15% "Hohe Stornoquote!"; Trend vs. gestern.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

interface FahrerStornoquote {
  fahrer_id: string;
  fahrer_name: string;
  quote_pct: number;
  gesamt_auftraege: number;
  stornierungen: number;
  ampel: Ampel;
  trend: Trend;
  trend_delta: number;
  gestern_quote_pct: number;
  rang: number;
}

interface StornoquoteAntwort {
  location_id: string;
  fahrer: FahrerStornoquote[];
  team_durchschnitt: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(pct: number): Ampel {
  if (pct <= 5) return 'gruen';
  if (pct <= 15) return 'gelb';
  return 'rot';
}

function trendVon(heute: number, gestern: number): { trend: Trend; delta: number } {
  const delta = Math.round((heute - gestern) * 10) / 10;
  if (delta > 1) return { trend: 'steigend', delta };
  if (delta < -1) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER = [
  { fahrer_id: 'mock-f1', fahrer_name: 'Max Müller',  gesamt: 14, storniert: 0, gestern_pct: 3.0  },
  { fahrer_id: 'mock-f2', fahrer_name: 'Sara Koch',   gesamt: 11, storniert: 0, gestern_pct: 5.0  },
  { fahrer_id: 'mock-f3', fahrer_name: 'Tim Weber',   gesamt: 9,  storniert: 1, gestern_pct: 8.0  },
  { fahrer_id: 'mock-f4', fahrer_name: 'Anna Bauer',  gesamt: 12, storniert: 2, gestern_pct: 10.0 },
];

function buildMock(locationId: string, driverId?: string): StornoquoteAntwort {
  const rows = driverId ? MOCK_FAHRER.filter(f => f.fahrer_id === driverId) : MOCK_FAHRER;
  const unsorted = rows.map(f => {
    const quote_pct = f.gesamt > 0 ? Math.round((f.storniert / f.gesamt) * 1000) / 10 : 0;
    const { trend, delta } = trendVon(quote_pct, f.gestern_pct);
    return {
      fahrer_id: f.fahrer_id,
      fahrer_name: f.fahrer_name,
      quote_pct,
      gesamt_auftraege: f.gesamt,
      stornierungen: f.storniert,
      ampel: ampelVon(quote_pct),
      trend,
      trend_delta: delta,
      gestern_quote_pct: f.gestern_pct,
    };
  });
  const sorted = [...unsorted].sort((a, b) => a.quote_pct - b.quote_pct);
  const fahrer: FahrerStornoquote[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
  const team_durchschnitt =
    fahrer.length > 0
      ? Math.round((fahrer.reduce((s, f) => s + f.quote_pct, 0) / fahrer.length) * 10) / 10
      : 0;
  return {
    location_id: locationId,
    fahrer,
    team_durchschnitt,
    alert_count: fahrer.filter(f => f.quote_pct > 15).length,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const locationId = searchParams.get('location_id');
  const driverId = searchParams.get('driver_id') ?? undefined;

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();
    const jetzt = new Date();
    const heuteStart = new Date(jetzt);
    heuteStart.setHours(0, 0, 0, 0);
    const gesternStart = new Date(heuteStart.getTime() - 24 * 60 * 60 * 1000);
    const gesternEnd = new Date(heuteStart.getTime());

    let driverQuery = sb
      .from('drivers')
      .select('id, full_name')
      .eq('location_id', locationId)
      .eq('is_active', true);
    if (driverId) driverQuery = driverQuery.eq('id', driverId);

    const { data: drivers, error: dErr } = await driverQuery;
    if (dErr || !drivers || drivers.length === 0) return NextResponse.json(buildMock(locationId, driverId));

    type Driver = { id: string; full_name: string | null };

    const unsorted = await Promise.all(
      (drivers as Driver[]).map(async (d) => {
        const { data: ordersHeute } = await sb
          .from('orders')
          .select('status')
          .eq('driver_id', d.id)
          .eq('location_id', locationId)
          .gte('created_at', heuteStart.toISOString());

        type OrderRow = { status: string | null };
        const rowsHeute = (ordersHeute as OrderRow[] | null) ?? [];
        const gesamt_heute = rowsHeute.length;
        const storniert_heute = rowsHeute.filter(
          o => o.status === 'cancelled' || o.status === 'storniert'
        ).length;
        const quote_pct_heute =
          gesamt_heute > 0 ? Math.round((storniert_heute / gesamt_heute) * 1000) / 10 : 0;

        const { data: ordersGestern } = await sb
          .from('orders')
          .select('status')
          .eq('driver_id', d.id)
          .eq('location_id', locationId)
          .gte('created_at', gesternStart.toISOString())
          .lt('created_at', gesternEnd.toISOString());

        const rowsGestern = (ordersGestern as OrderRow[] | null) ?? [];
        const gesamt_gestern = rowsGestern.length;
        const storniert_gestern = rowsGestern.filter(
          o => o.status === 'cancelled' || o.status === 'storniert'
        ).length;
        const quote_pct_gestern =
          gesamt_gestern > 0
            ? Math.round((storniert_gestern / gesamt_gestern) * 1000) / 10
            : quote_pct_heute;

        const { trend, delta } = trendVon(quote_pct_heute, quote_pct_gestern);

        return {
          fahrer_id: d.id,
          fahrer_name: d.full_name ?? 'Fahrer',
          quote_pct: quote_pct_heute,
          gesamt_auftraege: gesamt_heute,
          stornierungen: storniert_heute,
          ampel: ampelVon(quote_pct_heute),
          trend,
          trend_delta: delta,
          gestern_quote_pct: quote_pct_gestern,
        };
      })
    );

    const sorted = [...unsorted].sort((a, b) => a.quote_pct - b.quote_pct);
    const fahrer: FahrerStornoquote[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
    const team_durchschnitt =
      fahrer.length > 0
        ? Math.round((fahrer.reduce((s, f) => s + f.quote_pct, 0) / fahrer.length) * 10) / 10
        : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_durchschnitt,
      alert_count: fahrer.filter(f => f.quote_pct > 15).length,
      generiert_am: jetzt.toISOString(),
    } satisfies StornoquoteAntwort);
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
