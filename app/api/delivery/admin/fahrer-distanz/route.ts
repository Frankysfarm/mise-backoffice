/**
 * GET /api/delivery/admin/fahrer-distanz?location_id=<uuid>
 *
 * Phase 2307 — Fahrer-Distanz-API
 * Km je Fahrer heute; Ø km je Tour; Trend vs. Vorwoche;
 * Alert wenn <10 km/Std oder >500 km/Tag; Ampel grün(normal)/gelb(niedrig)/rot(kritisch);
 * Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALERT_NIEDRIG_KMH = 10;   // <10 km/h → Ampel gelb
const ALERT_MAX_KM_TAG = 500;   // >500 km/Tag → Ampel rot

export type DistanzAmpel = 'gruen' | 'gelb' | 'rot';

export interface FahrerDistanzInfo {
  fahrer_id: string;
  fahrer_name: string;
  km_heute: number;
  avg_km_tour: number;
  touren_anzahl: number;
  km_h_schnitt: number;
  trend_vs_vorwoche_pct: number | null;
  ampel: DistanzAmpel;
  alert: boolean;
}

export interface FahrerDistanzResponse {
  location_id: string;
  fahrer: FahrerDistanzInfo[];
  team_avg_km: number;
  team_avg_km_tour: number;
  alert_count: number;
  generiert_am: string;
}

function ampelOf(km_heute: number, km_h_schnitt: number): DistanzAmpel {
  if (km_heute > ALERT_MAX_KM_TAG) return 'rot';
  if (km_h_schnitt < ALERT_NIEDRIG_KMH && km_h_schnitt > 0) return 'gelb';
  return 'gruen';
}

const MOCK: FahrerDistanzResponse = {
  location_id: 'mock',
  fahrer: [
    {
      fahrer_id: 'f1', fahrer_name: 'Max Müller',
      km_heute: 87, avg_km_tour: 8.7, touren_anzahl: 10, km_h_schnitt: 22,
      trend_vs_vorwoche_pct: 5, ampel: 'gruen', alert: false,
    },
    {
      fahrer_id: 'f2', fahrer_name: 'Lisa Schmidt',
      km_heute: 34, avg_km_tour: 5.7, touren_anzahl: 6, km_h_schnitt: 8,
      trend_vs_vorwoche_pct: -12, ampel: 'gelb', alert: true,
    },
    {
      fahrer_id: 'f3', fahrer_name: 'Tom Wagner',
      km_heute: 521, avg_km_tour: 52.1, touren_anzahl: 10, km_h_schnitt: 58,
      trend_vs_vorwoche_pct: 120, ampel: 'rot', alert: true,
    },
    {
      fahrer_id: 'f4', fahrer_name: 'Anna Becker',
      km_heute: 112, avg_km_tour: 11.2, touren_anzahl: 10, km_h_schnitt: 28,
      trend_vs_vorwoche_pct: 0, ampel: 'gruen', alert: false,
    },
  ],
  team_avg_km: 188,
  team_avg_km_tour: 19.4,
  alert_count: 2,
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id')?.trim();
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  try {
    const sb = await createClient();
    const schichtStart = new Date();
    schichtStart.setHours(0, 0, 0, 0);
    const vorwocheStart = new Date(schichtStart);
    vorwocheStart.setDate(vorwocheStart.getDate() - 7);
    const vorwocheEnd = new Date(vorwocheStart);
    vorwocheEnd.setHours(23, 59, 59, 999);

    const { data: fahrerRows, error } = await sb
      .from('delivery_drivers')
      .select('id, name')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (error || !fahrerRows?.length) {
      return NextResponse.json({ ...MOCK, location_id: locationId });
    }

    const fahrer: FahrerDistanzInfo[] = await Promise.all(
      fahrerRows.map(async (f) => {
        const { data: touren } = await sb
          .from('delivery_tours')
          .select('distance_km, duration_min, completed_at')
          .eq('driver_id', f.id)
          .gte('completed_at', schichtStart.toISOString())
          .not('distance_km', 'is', null);

        const rows = touren ?? [];
        const km_heute = rows.reduce((s, t) => s + (t.distance_km ?? 0), 0);
        const touren_anzahl = rows.length;
        const avg_km_tour = touren_anzahl > 0 ? km_heute / touren_anzahl : 0;
        const total_min = rows.reduce((s, t) => s + (t.duration_min ?? 0), 0);
        const km_h_schnitt = total_min > 0 ? (km_heute / total_min) * 60 : 0;

        const { data: vorwocheTouren } = await sb
          .from('delivery_tours')
          .select('distance_km')
          .eq('driver_id', f.id)
          .gte('completed_at', vorwocheStart.toISOString())
          .lte('completed_at', vorwocheEnd.toISOString())
          .not('distance_km', 'is', null);

        const km_vorwoche = (vorwocheTouren ?? []).reduce((s, t) => s + (t.distance_km ?? 0), 0);
        const trend_vs_vorwoche_pct =
          km_vorwoche > 0 ? Math.round(((km_heute - km_vorwoche) / km_vorwoche) * 100) : null;

        const ampel = ampelOf(km_heute, km_h_schnitt);

        return {
          fahrer_id: f.id,
          fahrer_name: f.name ?? 'Unbekannt',
          km_heute: Math.round(km_heute * 10) / 10,
          avg_km_tour: Math.round(avg_km_tour * 10) / 10,
          touren_anzahl,
          km_h_schnitt: Math.round(km_h_schnitt),
          trend_vs_vorwoche_pct,
          ampel,
          alert: ampel !== 'gruen',
        };
      }),
    );

    const alert_count = fahrer.filter((f) => f.alert).length;
    const team_avg_km =
      fahrer.length > 0
        ? Math.round((fahrer.reduce((s, f) => s + f.km_heute, 0) / fahrer.length) * 10) / 10
        : 0;
    const team_avg_km_tour =
      fahrer.length > 0
        ? Math.round((fahrer.reduce((s, f) => s + f.avg_km_tour, 0) / fahrer.length) * 10) / 10
        : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_avg_km,
      team_avg_km_tour,
      alert_count,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerDistanzResponse);
  } catch {
    return NextResponse.json({ ...MOCK, location_id: locationId });
  }
}
