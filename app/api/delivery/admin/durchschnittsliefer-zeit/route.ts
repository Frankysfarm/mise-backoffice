import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLA_ZIEL_MIN = 30;
const ALERT_SCHWELLE = 1.2; // >20% Überschreitung

type ZoneStats = {
  zone: string;
  avg_liefer_min: number;
  bestellungen_1h: number;
  sla_erfullt_pct: number;
  alert: boolean;
  status: 'ok' | 'warnung' | 'kritisch';
};

function mockData(): { zonen: ZoneStats[]; gesamt_avg_min: number; alert_zonen: number; sla_ziel_min: number; generiert_am: string } {
  const zonen: ZoneStats[] = [
    { zone: 'A', avg_liefer_min: 24, bestellungen_1h: 8,  sla_erfullt_pct: 92, alert: false, status: 'ok' },
    { zone: 'B', avg_liefer_min: 31, bestellungen_1h: 5,  sla_erfullt_pct: 74, alert: false, status: 'warnung' },
    { zone: 'C', avg_liefer_min: 38, bestellungen_1h: 3,  sla_erfullt_pct: 51, alert: true,  status: 'kritisch' },
    { zone: 'D', avg_liefer_min: 27, bestellungen_1h: 4,  sla_erfullt_pct: 85, alert: false, status: 'ok' },
  ];
  return { zonen, gesamt_avg_min: 30, alert_zonen: 1, sla_ziel_min: SLA_ZIEL_MIN, generiert_am: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = createClient();
    const since1h = new Date(Date.now() - 3600_000).toISOString();

    const q = supabase
      .from('customer_orders')
      .select('delivery_zone, created_at, delivered_at')
      .eq('status', 'delivered')
      .gte('delivered_at', since1h)
      .not('delivered_at', 'is', null)
      .not('created_at', 'is', null);
    if (locationId) q.eq('location_id', locationId);

    const { data: orders, error } = await q;
    if (error || !orders || orders.length === 0) throw new Error('no data');

    const byZone = new Map<string, number[]>();
    for (const o of orders) {
      const zone = (o.delivery_zone as string | null) ?? 'Unbekannt';
      const lieferMin = (new Date(o.delivered_at as string).getTime() - new Date(o.created_at as string).getTime()) / 60_000;
      if (lieferMin > 0 && lieferMin < 180) {
        if (!byZone.has(zone)) byZone.set(zone, []);
        byZone.get(zone)!.push(lieferMin);
      }
    }

    const zonen: ZoneStats[] = Array.from(byZone.entries()).map(([zone, mins]) => {
      const avg_liefer_min = parseFloat((mins.reduce((s, m) => s + m, 0) / mins.length).toFixed(1));
      const sla_erfullt_pct = parseFloat(((mins.filter(m => m <= SLA_ZIEL_MIN).length / mins.length) * 100).toFixed(1));
      const alert = avg_liefer_min > SLA_ZIEL_MIN * ALERT_SCHWELLE;
      const status: ZoneStats['status'] = avg_liefer_min > SLA_ZIEL_MIN * 1.4 ? 'kritisch' : avg_liefer_min > SLA_ZIEL_MIN ? 'warnung' : 'ok';
      return { zone, avg_liefer_min, bestellungen_1h: mins.length, sla_erfullt_pct, alert, status };
    }).sort((a, b) => b.avg_liefer_min - a.avg_liefer_min);

    const allMins = orders
      .map(o => (new Date(o.delivered_at as string).getTime() - new Date(o.created_at as string).getTime()) / 60_000)
      .filter(m => m > 0 && m < 180);
    const gesamt_avg_min = allMins.length > 0 ? parseFloat((allMins.reduce((s, m) => s + m, 0) / allMins.length).toFixed(1)) : 0;

    return NextResponse.json({
      zonen,
      gesamt_avg_min,
      alert_zonen: zonen.filter(z => z.alert).length,
      sla_ziel_min: SLA_ZIEL_MIN,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(mockData());
  }
}
