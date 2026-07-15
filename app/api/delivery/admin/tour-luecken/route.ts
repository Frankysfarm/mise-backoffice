/**
 * GET /api/delivery/admin/tour-luecken?location_id=<uuid>
 *
 * Phase 1727 — Tour-Lücken-Erkennung-API (Backend)
 * Zeiträume ohne aktive Tour je Fahrer heute; Lücke >15 Min → Alert;
 * Effizienz-Score je Fahrer; Multi-Tenant via location_id; Supabase + Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface TourLuecke {
  von: string;
  bis: string;
  dauer_min: number;
  alert: boolean;
}

export interface FahrerLueckenProfil {
  driver_id: string;
  fahrer_name: string;
  touren_heute: number;
  aktiv_min: number;
  idle_min: number;
  effizienz_score: number;
  luecken: TourLuecke[];
}

export interface TourLueckenResponse {
  fahrer: FahrerLueckenProfil[];
  location_id: string;
  datum: string;
  generiert_am: string;
}

function effizenzScore(aktiv_min: number, idle_min: number): number {
  const total = aktiv_min + idle_min;
  if (total === 0) return 0;
  return Math.round((aktiv_min / total) * 100);
}

function buildMock(locationId: string): TourLueckenResponse {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const baseMs = today.getTime() + 8 * 3600_000;

  const makeFahrer = (
    driver_id: string,
    fahrer_name: string,
    tourSlots: Array<[number, number]>,
  ): FahrerLueckenProfil => {
    const luecken: TourLuecke[] = [];
    let aktiv_min = 0;
    for (let i = 0; i < tourSlots.length; i++) {
      const [start, end] = tourSlots[i];
      aktiv_min += end - start;
      if (i < tourSlots.length - 1) {
        const gapStart = tourSlots[i][1];
        const gapEnd = tourSlots[i + 1][0];
        const dauer = gapEnd - gapStart;
        luecken.push({
          von: new Date(baseMs + gapStart * 60_000).toISOString(),
          bis: new Date(baseMs + gapEnd * 60_000).toISOString(),
          dauer_min: dauer,
          alert: dauer > 15,
        });
      }
    }
    const idle_min = luecken.reduce((s, l) => s + l.dauer_min, 0);
    return {
      driver_id,
      fahrer_name,
      touren_heute: tourSlots.length,
      aktiv_min,
      idle_min,
      effizienz_score: effizenzScore(aktiv_min, idle_min),
      luecken,
    };
  };

  return {
    fahrer: [
      makeFahrer('mock-1', 'Max Müller', [[0, 45], [70, 120], [145, 200]]),
      makeFahrer('mock-2', 'Anna Schmidt', [[10, 55], [58, 100], [110, 165], [200, 240]]),
      makeFahrer('mock-3', 'Klaus Weber', [[0, 30], [60, 90]]),
    ],
    location_id: locationId,
    datum: new Date().toISOString().slice(0, 10),
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: touren, error } = await sb
      .from('delivery_tours')
      .select('id, driver_id, started_at, completed_at, status')
      .eq('location_id', locationId)
      .gte('started_at', todayStart.toISOString())
      .not('driver_id', 'is', null)
      .order('driver_id')
      .order('started_at');

    if (error || !touren?.length) return NextResponse.json(buildMock(locationId));

    type TourRow = {
      id: string;
      driver_id: string | null;
      started_at: string | null;
      completed_at: string | null;
      status: string | null;
    };

    const byDriver: Record<string, TourRow[]> = {};
    for (const t of touren as TourRow[]) {
      if (!t.driver_id) continue;
      byDriver[t.driver_id] = byDriver[t.driver_id] ?? [];
      byDriver[t.driver_id].push(t);
    }

    const fahrer: FahrerLueckenProfil[] = Object.entries(byDriver).map(([driver_id, rows]) => {
      rows.sort((a, b) => (a.started_at ?? '').localeCompare(b.started_at ?? ''));
      const luecken: TourLuecke[] = [];
      let aktiv_min = 0;

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const start = r.started_at ? new Date(r.started_at).getTime() : null;
        const end = r.completed_at ? new Date(r.completed_at).getTime() : Date.now();
        if (start) aktiv_min += Math.floor((end - start) / 60_000);

        if (i < rows.length - 1) {
          const gapVon = r.completed_at ?? r.started_at;
          const gapBis = rows[i + 1].started_at;
          if (gapVon && gapBis) {
            const dauer_min = Math.floor(
              (new Date(gapBis).getTime() - new Date(gapVon).getTime()) / 60_000,
            );
            if (dauer_min > 0) {
              luecken.push({ von: gapVon, bis: gapBis, dauer_min, alert: dauer_min > 15 });
            }
          }
        }
      }

      const idle_min = luecken.reduce((s, l) => s + l.dauer_min, 0);
      return {
        driver_id,
        fahrer_name: `Fahrer ${driver_id.slice(0, 6)}`,
        touren_heute: rows.length,
        aktiv_min,
        idle_min,
        effizienz_score: effizenzScore(aktiv_min, idle_min),
        luecken,
      };
    });

    if (!fahrer.length) return NextResponse.json(buildMock(locationId));

    return NextResponse.json({
      fahrer,
      location_id: locationId,
      datum: new Date().toISOString().slice(0, 10),
      generiert_am: new Date().toISOString(),
    } satisfies TourLueckenResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
