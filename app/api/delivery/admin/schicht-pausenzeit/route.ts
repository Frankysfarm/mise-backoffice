import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerPausenzeit {
  driver_id: string;
  name: string;
  avg_idle_min: number;
  idle_over_15_count: number;
  aktiv_min: number;
  gesamt_min: number;
  effizienz_pct: number;
  alert: boolean;
}

export interface SchichtPausenzeitResponse {
  location_id: string;
  fahrer: FahrerPausenzeit[];
  team_avg_idle_min: number;
  alert_count: number;
  generiert_am: string;
}

const IDLE_ALERT_MIN = 15;

const MOCK: SchichtPausenzeitResponse = {
  location_id: 'mock',
  fahrer: [
    { driver_id: 'd1', name: 'Max M.', avg_idle_min: 8.2, idle_over_15_count: 0, aktiv_min: 210, gesamt_min: 270, effizienz_pct: 78, alert: false },
    { driver_id: 'd2', name: 'Sarah K.', avg_idle_min: 5.4, idle_over_15_count: 0, aktiv_min: 240, gesamt_min: 270, effizienz_pct: 89, alert: false },
    { driver_id: 'd3', name: 'Tom B.', avg_idle_min: 22.1, idle_over_15_count: 3, aktiv_min: 120, gesamt_min: 270, effizienz_pct: 44, alert: true },
    { driver_id: 'd4', name: 'Anna L.', avg_idle_min: 11.0, idle_over_15_count: 1, aktiv_min: 195, gesamt_min: 270, effizienz_pct: 72, alert: false },
  ],
  team_avg_idle_min: 11.7,
  alert_count: 1,
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id')?.trim();
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: drivers } = await sb
      .from('drivers')
      .select('id, vorname, nachname')
      .eq('location_id', locationId);

    const { data: batches } = await sb
      .from('delivery_batches')
      .select('id, driver_id, assigned_at, picked_up_at, delivered_at, created_at')
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString())
      .not('delivered_at', 'is', null)
      .order('picked_up_at', { ascending: true });

    if (!drivers || !batches || drivers.length === 0) return NextResponse.json(MOCK);

    const fahrerList: FahrerPausenzeit[] = [];

    for (const d of drivers) {
      const myBatches = batches
        .filter(b => b.driver_id === d.id && b.picked_up_at && b.delivered_at)
        .sort((a, b) => new Date(a.picked_up_at as string).getTime() - new Date(b.picked_up_at as string).getTime());

      if (myBatches.length === 0) continue;

      const aktivSegments: number[] = [];
      const idleGaps: number[] = [];

      for (let i = 0; i < myBatches.length; i++) {
        const pickupMs = new Date(myBatches[i].picked_up_at as string).getTime();
        const deliveredMs = new Date(myBatches[i].delivered_at as string).getTime();
        const segMin = (deliveredMs - pickupMs) / 60_000;
        if (segMin >= 0 && segMin < 300) aktivSegments.push(segMin);

        if (i + 1 < myBatches.length) {
          const nextPickup = new Date(myBatches[i + 1].picked_up_at as string).getTime();
          const gapMin = (nextPickup - deliveredMs) / 60_000;
          if (gapMin >= 0 && gapMin < 120) idleGaps.push(gapMin);
        }
      }

      if (aktivSegments.length === 0) continue;

      const aktivMin = Math.round(aktivSegments.reduce((a, b) => a + b, 0));
      const avgIdle = idleGaps.length > 0
        ? Math.round((idleGaps.reduce((a, b) => a + b, 0) / idleGaps.length) * 10) / 10
        : 0;
      const idleOver15 = idleGaps.filter(g => g > IDLE_ALERT_MIN).length;

      const firstPickup = new Date(myBatches[0].picked_up_at as string).getTime();
      const lastDelivery = new Date(myBatches[myBatches.length - 1].delivered_at as string).getTime();
      const gesamtMin = Math.max(Math.round((lastDelivery - firstPickup) / 60_000), 1);
      const effizienzPct = Math.min(100, Math.round((aktivMin / gesamtMin) * 100));

      fahrerList.push({
        driver_id: d.id,
        name: `${d.vorname ?? ''} ${d.nachname ?? ''}`.trim() || 'Fahrer',
        avg_idle_min: avgIdle,
        idle_over_15_count: idleOver15,
        aktiv_min: aktivMin,
        gesamt_min: gesamtMin,
        effizienz_pct: effizienzPct,
        alert: avgIdle > IDLE_ALERT_MIN,
      });
    }

    if (fahrerList.length === 0) return NextResponse.json(MOCK);

    fahrerList.sort((a, b) => b.avg_idle_min - a.avg_idle_min);

    const teamAvg =
      Math.round((fahrerList.reduce((s, f) => s + f.avg_idle_min, 0) / fahrerList.length) * 10) / 10;

    return NextResponse.json({
      location_id: locationId,
      fahrer: fahrerList,
      team_avg_idle_min: teamAvg,
      alert_count: fahrerList.filter(f => f.alert).length,
      generiert_am: new Date().toISOString(),
    } satisfies SchichtPausenzeitResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
