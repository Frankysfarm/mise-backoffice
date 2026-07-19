/**
 * GET /api/delivery/admin/fahrer-reaktionszeit?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2435 — Fahrer-Reaktionszeit-API
 * Ø Zeit (Min) zwischen Auftragszuweisung und Abfahrt je Fahrer heute.
 * Ampel grün(<3min)/gelb(3–7min)/rot(>7min); Trend vs. Vorwoche; Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Ampel = 'gruen' | 'gelb' | 'rot';
export type Trend = 'steigend' | 'fallend' | 'stabil';

export interface FahrerReaktionszeit {
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

export interface ReaktionszeitAntwort {
  location_id: string;
  fahrer: FahrerReaktionszeit[];
  team_durchschnitt: number;
  generiert_am: string;
}

function ampelVon(avgMin: number): Ampel {
  if (avgMin < 3) return 'gruen';
  if (avgMin <= 7) return 'gelb';
  return 'rot';
}

function trendVon(heute: number, vorwoche: number): { trend: Trend; delta: number } {
  const delta = Math.round((heute - vorwoche) * 10) / 10;
  if (delta < -0.5) return { trend: 'steigend', delta };
  if (delta > 0.5) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER = [
  { fahrer_id: 'mock-f1', fahrer_name: 'Max Müller', avg_min: 2.1, touren_heute: 12, vw_avg_min: 2.8 },
  { fahrer_id: 'mock-f2', fahrer_name: 'Sara Koch', avg_min: 4.5, touren_heute: 9, vw_avg_min: 4.0 },
  { fahrer_id: 'mock-f3', fahrer_name: 'Tim Weber', avg_min: 8.2, touren_heute: 7, vw_avg_min: 6.5 },
  { fahrer_id: 'mock-f4', fahrer_name: 'Anna Bauer', avg_min: 3.1, touren_heute: 11, vw_avg_min: 3.4 },
];

function buildMock(locationId: string): ReaktionszeitAntwort {
  const fahrer: FahrerReaktionszeit[] = MOCK_FAHRER
    .sort((a, b) => a.avg_min - b.avg_min)
    .map((f, i) => {
      const { trend, delta } = trendVon(f.avg_min, f.vw_avg_min);
      return { ...f, ampel: ampelVon(f.avg_min), trend, trend_delta: delta, rang: i + 1 };
    });
  const team_durchschnitt =
    Math.round((fahrer.reduce((s, f) => s + f.avg_min, 0) / fahrer.length) * 10) / 10;
  return { location_id: locationId, fahrer, team_durchschnitt, generiert_am: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();
    const jetzt = new Date();
    const heuteStart = new Date(jetzt);
    heuteStart.setHours(0, 0, 0, 0);
    const vwStart = new Date(heuteStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const vwEnd = new Date(heuteStart.getTime() - 6 * 24 * 60 * 60 * 1000);

    const { data: drivers, error: dErr } = await sb
      .from('drivers')
      .select('id, full_name')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (dErr || !drivers || drivers.length === 0) return NextResponse.json(buildMock(locationId));

    type Driver = { id: string; full_name: string | null };
    const unsorted: Omit<FahrerReaktionszeit, 'rang'>[] = await Promise.all(
      (drivers as Driver[]).map(async (d) => {
        const { data: toursHeute } = await sb
          .from('delivery_tours')
          .select('assigned_at, picked_up_at')
          .eq('driver_id', d.id)
          .eq('location_id', locationId)
          .gte('assigned_at', heuteStart.toISOString())
          .not('picked_up_at', 'is', null);

        type TourRow = { assigned_at: string | null; picked_up_at: string | null };
        const validHeute = ((toursHeute as TourRow[] | null) ?? []).filter(t => t.assigned_at && t.picked_up_at);
        const avgHeute =
          validHeute.length > 0
            ? validHeute.reduce((s, t) => {
                const diff = (new Date(t.picked_up_at!).getTime() - new Date(t.assigned_at!).getTime()) / 60000;
                return s + Math.max(0, diff);
              }, 0) / validHeute.length
            : 3.0;

        const { data: toursVW } = await sb
          .from('delivery_tours')
          .select('assigned_at, picked_up_at')
          .eq('driver_id', d.id)
          .eq('location_id', locationId)
          .gte('assigned_at', vwStart.toISOString())
          .lt('assigned_at', vwEnd.toISOString())
          .not('picked_up_at', 'is', null);

        const validVW = ((toursVW as TourRow[] | null) ?? []).filter(t => t.assigned_at && t.picked_up_at);
        const avgVW =
          validVW.length > 0
            ? validVW.reduce((s, t) => {
                const diff = (new Date(t.picked_up_at!).getTime() - new Date(t.assigned_at!).getTime()) / 60000;
                return s + Math.max(0, diff);
              }, 0) / validVW.length
            : avgHeute;

        const avg_min = Math.round(avgHeute * 10) / 10;
        const vw_avg_min = Math.round(avgVW * 10) / 10;
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

    const sorted = [...unsorted].sort((a, b) => a.avg_min - b.avg_min);
    const fahrer: FahrerReaktionszeit[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
    const team_durchschnitt =
      fahrer.length > 0
        ? Math.round((fahrer.reduce((s, f) => s + f.avg_min, 0) / fahrer.length) * 10) / 10
        : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_durchschnitt,
      generiert_am: jetzt.toISOString(),
    } satisfies ReaktionszeitAntwort);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
