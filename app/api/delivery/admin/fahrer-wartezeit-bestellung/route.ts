/**
 * GET /api/delivery/admin/fahrer-wartezeit-bestellung?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2629 — Fahrer-Wartezeit-Bestellung-API
 * Ø Wartezeit (Min) je Fahrer am Depot vor Übergabe (assigned_at → pickup_at).
 * Ampel grün(≤5)/gelb(6–10)/rot(>10 Min); Alert >10 Min; Trend vs. gestern; Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Ampel = 'gruen' | 'gelb' | 'rot';
export type Trend = 'steigend' | 'fallend' | 'stabil';

export interface FahrerWartezeit {
  fahrer_id: string;
  fahrer_name: string;
  avg_min: number;
  touren_heute: number;
  ampel: Ampel;
  trend: Trend;
  trend_delta: number;
  vw_avg_min: number;
  rang: number;
}

export interface WartezeitAntwort {
  location_id: string;
  fahrer: FahrerWartezeit[];
  team_durchschnitt: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(avgMin: number): Ampel {
  if (avgMin <= 5) return 'gruen';
  if (avgMin <= 10) return 'gelb';
  return 'rot';
}

function trendVon(heute: number, gestern: number): { trend: Trend; delta: number } {
  const delta = Math.round((heute - gestern) * 10) / 10;
  if (delta < -0.5) return { trend: 'fallend', delta };
  if (delta > 0.5) return { trend: 'steigend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER = [
  { fahrer_id: 'mock-f1', fahrer_name: 'Max Müller',  avg_min:  3.5, touren_heute: 12, vw_avg_min:  4.2 },
  { fahrer_id: 'mock-f2', fahrer_name: 'Sara Koch',   avg_min:  7.8, touren_heute:  9, vw_avg_min:  6.5 },
  { fahrer_id: 'mock-f3', fahrer_name: 'Tim Weber',   avg_min: 13.1, touren_heute:  7, vw_avg_min: 11.0 },
  { fahrer_id: 'mock-f4', fahrer_name: 'Anna Bauer',  avg_min:  5.2, touren_heute: 11, vw_avg_min:  5.8 },
];

function buildMock(locationId: string) {
  const fahrer: FahrerWartezeit[] = [...MOCK_FAHRER]
    .sort((a, b) => b.avg_min - a.avg_min)
    .map((f, i) => {
      const { trend, delta } = trendVon(f.avg_min, f.vw_avg_min);
      return { ...f, ampel: ampelVon(f.avg_min), trend, trend_delta: delta, rang: i + 1 };
    });
  const team_durchschnitt =
    Math.round((fahrer.reduce((s, f) => s + f.avg_min, 0) / fahrer.length) * 10) / 10;
  const alert_count = fahrer.filter(f => f.avg_min > 10).length;
  return {
    location_id: locationId,
    fahrer,
    team_durchschnitt,
    alert_count,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  const driverIdFilter = searchParams.get('driver_id');

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
    if (driverIdFilter) driverQuery = driverQuery.eq('id', driverIdFilter);

    const { data: drivers, error: dErr } = await driverQuery;
    if (dErr || !drivers || drivers.length === 0) return NextResponse.json(buildMock(locationId));

    type Driver = { id: string; full_name: string | null };
    type TourRow = { assigned_at: string | null; picked_up_at: string | null };

    const unsorted: Omit<FahrerWartezeit, 'rang'>[] = await Promise.all(
      (drivers as Driver[]).map(async (d) => {
        const { data: toursHeute } = await sb
          .from('delivery_tours')
          .select('assigned_at, picked_up_at')
          .eq('driver_id', d.id)
          .eq('location_id', locationId)
          .gte('assigned_at', heuteStart.toISOString())
          .not('picked_up_at', 'is', null);

        const validHeute = ((toursHeute as TourRow[] | null) ?? []).filter(
          t => t.assigned_at && t.picked_up_at
        );
        const avgHeute =
          validHeute.length > 0
            ? validHeute.reduce((s, t) => {
                const diff =
                  (new Date(t.picked_up_at!).getTime() - new Date(t.assigned_at!).getTime()) /
                  60000;
                return s + Math.max(0, diff);
              }, 0) / validHeute.length
            : 5.0;

        const { data: toursGestern } = await sb
          .from('delivery_tours')
          .select('assigned_at, picked_up_at')
          .eq('driver_id', d.id)
          .eq('location_id', locationId)
          .gte('assigned_at', gesternStart.toISOString())
          .lt('assigned_at', gesternEnd.toISOString())
          .not('picked_up_at', 'is', null);

        const validGestern = ((toursGestern as TourRow[] | null) ?? []).filter(
          t => t.assigned_at && t.picked_up_at
        );
        const avgGestern =
          validGestern.length > 0
            ? validGestern.reduce((s, t) => {
                const diff =
                  (new Date(t.picked_up_at!).getTime() - new Date(t.assigned_at!).getTime()) /
                  60000;
                return s + Math.max(0, diff);
              }, 0) / validGestern.length
            : avgHeute;

        const avg_min = Math.round(avgHeute * 10) / 10;
        const vw_avg_min = Math.round(avgGestern * 10) / 10;
        const { trend, delta } = trendVon(avg_min, vw_avg_min);

        return {
          fahrer_id: d.id,
          fahrer_name: d.full_name ?? 'Fahrer',
          avg_min,
          touren_heute: validHeute.length,
          ampel: ampelVon(avg_min),
          trend,
          trend_delta: delta,
          vw_avg_min,
        };
      })
    );

    const sorted = [...unsorted].sort((a, b) => b.avg_min - a.avg_min);
    const fahrer: FahrerWartezeit[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
    const team_durchschnitt =
      fahrer.length > 0
        ? Math.round((fahrer.reduce((s, f) => s + f.avg_min, 0) / fahrer.length) * 10) / 10
        : 0;
    const alert_count = fahrer.filter(f => f.avg_min > 10).length;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_durchschnitt,
      alert_count,
      generiert_am: jetzt.toISOString(),
    });
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
