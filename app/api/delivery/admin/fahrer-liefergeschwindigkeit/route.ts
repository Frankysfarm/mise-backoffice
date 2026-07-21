/**
 * GET /api/delivery/admin/fahrer-liefergeschwindigkeit?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2881 — Fahrer-Liefergeschwindigkeit-API
 * Ø Lieferzeit (confirmed_at → actual_delivery_at) je Fahrer heute in Min.
 * Ampel grün(≤25 Min)/gelb(26–35 Min)/rot(>35 Min); Alert "Zu langsam!"; Trend vs. gestern; Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Ampel = 'gruen' | 'gelb' | 'rot';
export type Trend = 'steigend' | 'fallend' | 'stabil';

export interface FahrerLiefergeschwindigkeit {
  fahrer_id: string;
  fahrer_name: string;
  avg_min: number;
  touren_heute: number;
  ampel: Ampel;
  alert: boolean;
  trend: Trend;
  trend_delta: number;
  gestern_avg_min: number;
  rang: number;
}

export interface LiefergeschwindigkeitAntwort {
  location_id: string;
  fahrer: FahrerLiefergeschwindigkeit[];
  team_durchschnitt: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(avgMin: number): Ampel {
  if (avgMin <= 25) return 'gruen';
  if (avgMin <= 35) return 'gelb';
  return 'rot';
}

function trendVon(heute: number, gestern: number): { trend: Trend; delta: number } {
  const delta = Math.round((heute - gestern) * 10) / 10;
  if (delta < -1) return { trend: 'fallend', delta };
  if (delta > 1) return { trend: 'steigend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER = [
  { fahrer_id: 'mock-f1', fahrer_name: 'Max Müller',  avg_min: 21.5, touren_heute: 12, gestern_avg_min: 23.0 },
  { fahrer_id: 'mock-f2', fahrer_name: 'Sara Koch',   avg_min: 27.3, touren_heute:  9, gestern_avg_min: 25.0 },
  { fahrer_id: 'mock-f3', fahrer_name: 'Tim Weber',   avg_min: 38.1, touren_heute:  7, gestern_avg_min: 36.5 },
  { fahrer_id: 'mock-f4', fahrer_name: 'Anna Bauer',  avg_min: 24.8, touren_heute: 11, gestern_avg_min: 26.2 },
];

function buildMock(locationId: string): LiefergeschwindigkeitAntwort {
  const fahrer: FahrerLiefergeschwindigkeit[] = MOCK_FAHRER
    .sort((a, b) => a.avg_min - b.avg_min)
    .map((f, i) => {
      const { trend, delta } = trendVon(f.avg_min, f.gestern_avg_min);
      const ampel = ampelVon(f.avg_min);
      return { ...f, ampel, alert: ampel === 'rot', trend, trend_delta: delta, rang: i + 1 };
    });
  const team_durchschnitt =
    Math.round((fahrer.reduce((s, f) => s + f.avg_min, 0) / fahrer.length) * 10) / 10;
  return {
    location_id: locationId,
    fahrer,
    team_durchschnitt,
    alert_count: fahrer.filter(f => f.alert).length,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();
    const jetzt = new Date();
    const heuteStart = new Date(jetzt);
    heuteStart.setHours(0, 0, 0, 0);
    const gesternStart = new Date(heuteStart.getTime() - 24 * 60 * 60 * 1000);
    const gesternEnd   = new Date(heuteStart.getTime());

    const driversQuery = sb
      .from('drivers')
      .select('id, full_name')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (driverId) driversQuery.eq('id', driverId);

    const { data: drivers, error: dErr } = await driversQuery;
    if (dErr || !drivers || drivers.length === 0) return NextResponse.json(buildMock(locationId));

    type Driver = { id: string; full_name: string | null };

    const unsorted: Omit<FahrerLiefergeschwindigkeit, 'rang'>[] = await Promise.all(
      (drivers as Driver[]).map(async (d) => {
        const { data: toursHeute } = await sb
          .from('delivery_tours')
          .select('confirmed_at, actual_delivery_at')
          .eq('driver_id', d.id)
          .eq('location_id', locationId)
          .gte('confirmed_at', heuteStart.toISOString())
          .not('actual_delivery_at', 'is', null);

        type TourRow = { confirmed_at: string | null; actual_delivery_at: string | null };
        const validHeute = ((toursHeute as TourRow[] | null) ?? []).filter(
          t => t.confirmed_at && t.actual_delivery_at
        );
        const avgHeute =
          validHeute.length > 0
            ? validHeute.reduce((s, t) => {
                const diff =
                  (new Date(t.actual_delivery_at!).getTime() - new Date(t.confirmed_at!).getTime()) / 60000;
                return s + Math.max(0, diff);
              }, 0) / validHeute.length
            : 25.0;

        const { data: toursGestern } = await sb
          .from('delivery_tours')
          .select('confirmed_at, actual_delivery_at')
          .eq('driver_id', d.id)
          .eq('location_id', locationId)
          .gte('confirmed_at', gesternStart.toISOString())
          .lt('confirmed_at', gesternEnd.toISOString())
          .not('actual_delivery_at', 'is', null);

        const validGestern = ((toursGestern as TourRow[] | null) ?? []).filter(
          t => t.confirmed_at && t.actual_delivery_at
        );
        const avgGestern =
          validGestern.length > 0
            ? validGestern.reduce((s, t) => {
                const diff =
                  (new Date(t.actual_delivery_at!).getTime() - new Date(t.confirmed_at!).getTime()) / 60000;
                return s + Math.max(0, diff);
              }, 0) / validGestern.length
            : avgHeute;

        const avg_min         = Math.round(avgHeute   * 10) / 10;
        const gestern_avg_min = Math.round(avgGestern * 10) / 10;
        const { trend, delta } = trendVon(avg_min, gestern_avg_min);
        const ampel = ampelVon(avg_min);

        return {
          fahrer_id: d.id,
          fahrer_name: d.full_name ?? 'Fahrer',
          avg_min,
          touren_heute: validHeute.length,
          ampel,
          alert: ampel === 'rot',
          trend,
          trend_delta: delta,
          gestern_avg_min,
        };
      })
    );

    const sorted = [...unsorted].sort((a, b) => a.avg_min - b.avg_min);
    const fahrer: FahrerLiefergeschwindigkeit[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
    const team_durchschnitt =
      fahrer.length > 0
        ? Math.round((fahrer.reduce((s, f) => s + f.avg_min, 0) / fahrer.length) * 10) / 10
        : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_durchschnitt,
      alert_count: fahrer.filter(f => f.alert).length,
      generiert_am: jetzt.toISOString(),
    } satisfies LiefergeschwindigkeitAntwort);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
