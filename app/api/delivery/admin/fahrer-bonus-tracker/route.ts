/**
 * GET /api/delivery/admin/fahrer-bonus-tracker
 *   ?location_id=<uuid>
 *
 * Phase 1268 — Fahrer-Bonus-Tracker API (Dispatch)
 * Wieviele Bonus-Stopps hat jeder Fahrer diesen Monat (≥50=Bronze, ≥100=Silber, ≥150=Gold).
 * Multi-Tenant: location_id on every query. Supabase + Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerBonusEintrag {
  fahrer_id: string;
  fahrer_name: string;
  stopps_monat: number;
  stufe: 'gold' | 'silber' | 'bronze' | 'keine';
  naechste_stufe_bei: number | null;
  fortschritt_pct: number;
  on_tour: boolean;
}

export interface FahrerBonusTrackerResponse {
  fahrer: FahrerBonusEintrag[];
  gold_count: number;
  silber_count: number;
  bronze_count: number;
  location_id: string;
  generiert_am: string;
}

const BRONZE = 50;
const SILBER = 100;
const GOLD = 150;

function stufeFor(stopps: number): FahrerBonusEintrag['stufe'] {
  if (stopps >= GOLD) return 'gold';
  if (stopps >= SILBER) return 'silber';
  if (stopps >= BRONZE) return 'bronze';
  return 'keine';
}

function naechsteStufe(stopps: number): number | null {
  if (stopps < BRONZE) return BRONZE;
  if (stopps < SILBER) return SILBER;
  if (stopps < GOLD) return GOLD;
  return null;
}

function fortschritt(stopps: number): number {
  if (stopps >= GOLD) return 100;
  if (stopps >= SILBER) return Math.round(((stopps - SILBER) / (GOLD - SILBER)) * 100);
  if (stopps >= BRONZE) return Math.round(((stopps - BRONZE) / (SILBER - BRONZE)) * 100);
  return Math.round((stopps / BRONZE) * 100);
}

function buildMock(locationId: string): FahrerBonusTrackerResponse {
  const fahrer: FahrerBonusEintrag[] = [
    { fahrer_id: 'f1', fahrer_name: 'Max M.', stopps_monat: 162, stufe: 'gold', naechste_stufe_bei: null, fortschritt_pct: 100, on_tour: true },
    { fahrer_id: 'f2', fahrer_name: 'Jana K.', stopps_monat: 118, stufe: 'silber', naechste_stufe_bei: 150, fortschritt_pct: 56, on_tour: false },
    { fahrer_id: 'f3', fahrer_name: 'Ali S.', stopps_monat: 87, stufe: 'bronze', naechste_stufe_bei: 100, fortschritt_pct: 74, on_tour: true },
    { fahrer_id: 'f4', fahrer_name: 'Nina B.', stopps_monat: 34, stufe: 'keine', naechste_stufe_bei: 50, fortschritt_pct: 68, on_tour: false },
  ];
  return {
    fahrer,
    gold_count: 1,
    silber_count: 1,
    bronze_count: 1,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = createClient();
    const now = new Date();
    const monatStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data: drivers, error: dErr } = await (sb as any)
      .from('mise_drivers')
      .select('id, name, on_tour, online')
      .eq('location_id', locationId);

    if (dErr || !drivers?.length) return NextResponse.json(buildMock(locationId));

    const driverIds: string[] = drivers.map((d: { id: string }) => d.id);

    const { data: stops, error: sErr } = await (sb as any)
      .from('mise_delivery_stops')
      .select('driver_id, delivered_at')
      .in('driver_id', driverIds)
      .gte('delivered_at', monatStart.toISOString())
      .not('delivered_at', 'is', null);

    if (sErr) return NextResponse.json(buildMock(locationId));

    const stopMap: Record<string, number> = {};
    for (const s of (stops ?? [])) {
      stopMap[s.driver_id] = (stopMap[s.driver_id] ?? 0) + 1;
    }

    const fahrer: FahrerBonusEintrag[] = drivers
      .map((d: { id: string; name: string; on_tour: boolean }) => {
        const stopps = stopMap[d.id] ?? 0;
        return {
          fahrer_id: d.id,
          fahrer_name: d.name ?? `Fahrer ${d.id.slice(-4)}`,
          stopps_monat: stopps,
          stufe: stufeFor(stopps),
          naechste_stufe_bei: naechsteStufe(stopps),
          fortschritt_pct: fortschritt(stopps),
          on_tour: d.on_tour ?? false,
        };
      })
      .sort((a: FahrerBonusEintrag, b: FahrerBonusEintrag) => b.stopps_monat - a.stopps_monat);

    return NextResponse.json({
      fahrer,
      gold_count: fahrer.filter((f: FahrerBonusEintrag) => f.stufe === 'gold').length,
      silber_count: fahrer.filter((f: FahrerBonusEintrag) => f.stufe === 'silber').length,
      bronze_count: fahrer.filter((f: FahrerBonusEintrag) => f.stufe === 'bronze').length,
      location_id: locationId,
      generiert_am: now.toISOString(),
    });
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
