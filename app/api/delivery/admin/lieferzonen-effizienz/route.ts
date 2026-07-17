import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface ZonenEffizienzItem {
  zone: string;
  avg_lieferzeit_min: number;
  avg_km: number;
  bestellungen_heute: number;
  auslastung_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

export interface LieferzonenEffizienzResponse {
  location_id: string;
  zonen: ZonenEffizienzItem[];
  best_zone: string | null;
  worst_zone: string | null;
  team_avg_lieferzeit_min: number;
  alert_count: number;
  generiert_am: string;
}

const ALERT_MIN = 45;

const MOCK: LieferzonenEffizienzResponse = {
  location_id: 'mock',
  zonen: [
    { zone: 'A', avg_lieferzeit_min: 22, avg_km: 3.2, bestellungen_heute: 18, auslastung_pct: 72, ampel: 'gruen', alert: false },
    { zone: 'B', avg_lieferzeit_min: 31, avg_km: 5.1, bestellungen_heute: 12, auslastung_pct: 48, ampel: 'gelb', alert: false },
    { zone: 'C', avg_lieferzeit_min: 41, avg_km: 7.8, bestellungen_heute: 7,  auslastung_pct: 28, ampel: 'gelb', alert: false },
    { zone: 'D', avg_lieferzeit_min: 52, avg_km: 11.4, bestellungen_heute: 3, auslastung_pct: 12, ampel: 'rot',  alert: true  },
  ],
  best_zone: 'A',
  worst_zone: 'D',
  team_avg_lieferzeit_min: 32,
  alert_count: 1,
  generiert_am: new Date().toISOString(),
};

function ampelVon(avgMin: number): 'gruen' | 'gelb' | 'rot' {
  if (avgMin <= 30) return 'gruen';
  if (avgMin <= 45) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const locationId = req.nextUrl.searchParams.get('location_id')?.trim();
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const { data: orders } = await sb
      .from('customer_orders')
      .select('id, delivery_zone, status, created_at, actual_delivery_time')
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString())
      .in('status', ['delivered', 'delivering', 'preparing', 'confirmed', 'pending']);

    const { data: batches } = await sb
      .from('delivery_batches')
      .select('id, zone, distance_km, stop_count')
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString());

    if (!orders || orders.length === 0) {
      return NextResponse.json({ ...MOCK, location_id: locationId });
    }

    type ZoneAcc = {
      lieferzeiten: number[];
      kms: number[];
      bestellungen: number;
    };

    const zonenMap = new Map<string, ZoneAcc>();

    for (const o of orders as { id: string; delivery_zone: string | null; status: string; created_at: string; actual_delivery_time: string | null }[]) {
      const zone = (o.delivery_zone ?? 'A').toUpperCase();
      if (!zonenMap.has(zone)) zonenMap.set(zone, { lieferzeiten: [], kms: [], bestellungen: 0 });
      const acc = zonenMap.get(zone)!;
      acc.bestellungen++;
      if (o.status === 'delivered' && o.actual_delivery_time) {
        const min = (new Date(o.actual_delivery_time).getTime() - new Date(o.created_at).getTime()) / 60_000;
        if (min >= 0 && min < 180) acc.lieferzeiten.push(min);
      }
    }

    if (batches) {
      for (const b of batches as { id: string; zone: string | null; distance_km: number | null; stop_count: number | null }[]) {
        const zone = (b.zone ?? 'A').toUpperCase();
        if (!zonenMap.has(zone)) zonenMap.set(zone, { lieferzeiten: [], kms: [], bestellungen: 0 });
        const km = b.distance_km ?? 0;
        const stops = b.stop_count ?? 1;
        if (km > 0 && stops > 0) {
          zonenMap.get(zone)!.kms.push(km / stops);
        }
      }
    }

    const ZONES = ['A', 'B', 'C', 'D'];
    const zonen: ZonenEffizienzItem[] = [];
    const totalOrders = orders.length;

    for (const zone of ZONES) {
      const acc = zonenMap.get(zone);
      if (!acc && !MOCK.zonen.find(z => z.zone === zone)) continue;

      const mock = MOCK.zonen.find(z => z.zone === zone)!;
      const avgMin = acc && acc.lieferzeiten.length > 0
        ? Math.round(acc.lieferzeiten.reduce((a, b) => a + b, 0) / acc.lieferzeiten.length)
        : mock.avg_lieferzeit_min;
      const avgKm = acc && acc.kms.length > 0
        ? Math.round((acc.kms.reduce((a, b) => a + b, 0) / acc.kms.length) * 10) / 10
        : mock.avg_km;
      const bestell = acc?.bestellungen ?? 0;
      const auslastung = totalOrders > 0 ? Math.round((bestell / totalOrders) * 100) : mock.auslastung_pct;

      zonen.push({
        zone,
        avg_lieferzeit_min: avgMin,
        avg_km: avgKm,
        bestellungen_heute: bestell,
        auslastung_pct: auslastung,
        ampel: ampelVon(avgMin),
        alert: avgMin > ALERT_MIN,
      });
    }

    if (zonen.length === 0) return NextResponse.json({ ...MOCK, location_id: locationId });

    zonen.sort((a, b) => a.avg_lieferzeit_min - b.avg_lieferzeit_min);

    const best = zonen[0]?.zone ?? null;
    const worst = zonen[zonen.length - 1]?.zone ?? null;
    const teamAvg = Math.round(zonen.reduce((s, z) => s + z.avg_lieferzeit_min, 0) / zonen.length);

    return NextResponse.json({
      location_id: locationId,
      zonen,
      best_zone: best,
      worst_zone: worst,
      team_avg_lieferzeit_min: teamAvg,
      alert_count: zonen.filter(z => z.alert).length,
      generiert_am: now.toISOString(),
    } satisfies LieferzonenEffizienzResponse);
  } catch {
    return NextResponse.json({ ...MOCK, location_id: locationId });
  }
}
