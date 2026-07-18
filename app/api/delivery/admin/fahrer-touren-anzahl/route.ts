import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ALERT_LOW = 4;
const ALERT_HIGH = 12;
const TARGET_MIN = 6;
const TARGET_MAX = 10;

function ampel(count: number): 'gruen' | 'gelb' | 'rot' {
  if (count >= TARGET_MIN && count <= TARGET_MAX) return 'gruen';
  if (count < ALERT_LOW || count > ALERT_HIGH) return 'rot';
  return 'gelb';
}

function mockData(locationId: string, driverId?: string) {
  const drivers = [
    { id: 'd1', name: 'Max M.', touren: 9, touren_vw: 8 },
    { id: 'd2', name: 'Sara K.', touren: 3, touren_vw: 7 },
    { id: 'd3', name: 'Tim B.', touren: 13, touren_vw: 11 },
    { id: 'd4', name: 'Julia F.', touren: 7, touren_vw: 6 },
  ];
  const fahrer = drivers.map((d, i) => ({
    fahrer_id: d.id,
    fahrer_name: d.name,
    touren_heute: d.touren,
    touren_vw: d.touren_vw,
    trend: d.touren > d.touren_vw ? 'steigend' : d.touren < d.touren_vw ? 'fallend' : 'stabil',
    trend_delta: d.touren - d.touren_vw,
    ampel: ampel(d.touren),
    alert_low: d.touren < ALERT_LOW,
    alert_high: d.touren > ALERT_HIGH,
    rang: i + 1,
  })).sort((a, b) => b.touren_heute - a.touren_heute).map((d, i) => ({ ...d, rang: i + 1 }));

  const team_avg = fahrer.reduce((s, f) => s + f.touren_heute, 0) / (fahrer.length || 1);
  const team_avg_vw = fahrer.reduce((s, f) => s + f.touren_vw, 0) / (fahrer.length || 1);
  const alert_count = fahrer.filter(f => f.alert_low || f.alert_high).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_touren: Math.round(team_avg * 10) / 10 };
  }

  return {
    fahrer,
    team_avg_touren: Math.round(team_avg * 10) / 10,
    team_avg_touren_vw: Math.round(team_avg_vw * 10) / 10,
    alert_count,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId = searchParams.get('driver_id') ?? undefined;

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = createServiceClient();
    const today = new Date().toISOString().slice(0, 10);
    const lastWeek = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, name')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (!drivers?.length) return NextResponse.json(mockData(locationId, driverId));

    async function tourCount(dId: string, date: string) {
      const { count } = await supabase
        .from('delivery_tours')
        .select('id', { count: 'exact', head: true })
        .eq('driver_id', dId)
        .gte('created_at', date + 'T00:00:00')
        .lte('created_at', date + 'T23:59:59')
        .in('status', ['completed', 'delivered']);
      return count ?? 0;
    }

    const fahrerData = await Promise.all(
      drivers.map(async (d, i) => {
        const [touren_heute, touren_vw] = await Promise.all([
          tourCount(d.id, today),
          tourCount(d.id, lastWeek),
        ]);
        return {
          fahrer_id: d.id,
          fahrer_name: d.name ?? 'Fahrer',
          touren_heute,
          touren_vw,
          trend: touren_heute > touren_vw ? 'steigend' : touren_heute < touren_vw ? 'fallend' : 'stabil',
          trend_delta: touren_heute - touren_vw,
          ampel: ampel(touren_heute),
          alert_low: touren_heute < ALERT_LOW,
          alert_high: touren_heute > ALERT_HIGH,
          rang: i + 1,
        };
      })
    );

    const sorted = fahrerData.sort((a, b) => b.touren_heute - a.touren_heute).map((d, i) => ({ ...d, rang: i + 1 }));
    const team_avg = sorted.reduce((s, f) => s + f.touren_heute, 0) / (sorted.length || 1);
    const team_avg_vw = sorted.reduce((s, f) => s + f.touren_vw, 0) / (sorted.length || 1);
    const alert_count = sorted.filter(f => f.alert_low || f.alert_high).length;

    if (driverId) {
      const f = sorted.find(d => d.fahrer_id === driverId) ?? sorted[0];
      return NextResponse.json({ fahrer_single: f, team_avg_touren: Math.round(team_avg * 10) / 10 });
    }

    return NextResponse.json({
      fahrer: sorted,
      team_avg_touren: Math.round(team_avg * 10) / 10,
      team_avg_touren_vw: Math.round(team_avg_vw * 10) / 10,
      alert_count,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(mockData(locationId, driverId));
  }
}
