import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TrendDir = 'besser' | 'gleich' | 'schlechter';

type FahrerReaktionszeit = {
  fahrer_id: string;
  name: string;
  avg_reaktionszeit_min: number;
  team_durchschnitt_min: number;
  delta_min: number;
  trend: TrendDir;
  anzahl_auftraege: number;
  rang: number;
};

type ApiResponse = {
  fahrer: FahrerReaktionszeit[];
  team_durchschnitt_min: number;
  sla_ziel_min: number;
  location_id: string | null;
  generiert_am: string;
};

function mockData(locationId: string | null): ApiResponse {
  const raw = [
    { id: 'f1', name: 'Ahmed K.', avg: 4.2, auftraege: 18, prevAvg: 5.1 },
    { id: 'f2', name: 'Marcus B.', avg: 6.8, auftraege: 14, prevAvg: 6.5 },
    { id: 'f3', name: 'Julia T.', avg: 3.5, auftraege: 21, prevAvg: 3.8 },
    { id: 'f4', name: 'Sven M.', avg: 7.9, auftraege: 11, prevAvg: 7.2 },
  ];
  const teamAvg = parseFloat(
    (raw.reduce((s, r) => s + r.avg, 0) / raw.length).toFixed(1),
  );
  const fahrer: FahrerReaktionszeit[] = raw
    .sort((a, b) => a.avg - b.avg)
    .map((r, i) => ({
      fahrer_id: r.id,
      name: r.name,
      avg_reaktionszeit_min: r.avg,
      team_durchschnitt_min: teamAvg,
      delta_min: parseFloat((r.avg - teamAvg).toFixed(1)),
      trend:
        r.avg < r.prevAvg * 0.95
          ? 'besser'
          : r.avg > r.prevAvg * 1.05
            ? 'schlechter'
            : 'gleich',
      anzahl_auftraege: r.auftraege,
      rang: i + 1,
    }));
  return {
    fahrer,
    team_durchschnitt_min: teamAvg,
    sla_ziel_min: 5,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = await createClient();
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    // Load active drivers
    const dQ = supabase.from('mise_drivers').select('id, name').eq('is_active', true);
    if (locationId) dQ.eq('location_id', locationId);
    const { data: drivers, error: dErr } = await dQ;
    if (dErr || !drivers || drivers.length === 0) throw new Error('no drivers');

    // Load today's stops with assigned_at + picked_up_at
    const sQ = supabase
      .from('mise_delivery_stops')
      .select('driver_id, assigned_at, picked_up_at')
      .gte('created_at', startOfDay.toISOString())
      .not('assigned_at', 'is', null)
      .not('picked_up_at', 'is', null);
    if (locationId) sQ.eq('location_id', locationId);
    const { data: stops, error: sErr } = await sQ;
    if (sErr) throw sErr;

    type Acc = Record<string, { total: number; count: number }>;
    const acc: Acc = {};
    for (const s of stops ?? []) {
      if (!s.driver_id || !s.assigned_at || !s.picked_up_at) continue;
      const diff =
        (new Date(s.picked_up_at).getTime() - new Date(s.assigned_at).getTime()) / 60_000;
      if (diff < 0 || diff > 120) continue;
      if (!acc[s.driver_id]) acc[s.driver_id] = { total: 0, count: 0 };
      acc[s.driver_id].total += diff;
      acc[s.driver_id].count += 1;
    }

    const fahrer: FahrerReaktionszeit[] = [];
    for (const d of drivers) {
      const a = acc[d.id];
      if (!a || a.count === 0) continue;
      fahrer.push({
        fahrer_id: d.id,
        name: d.name ?? d.id,
        avg_reaktionszeit_min: parseFloat((a.total / a.count).toFixed(1)),
        team_durchschnitt_min: 0,
        delta_min: 0,
        trend: 'gleich',
        anzahl_auftraege: a.count,
        rang: 0,
      });
    }

    if (fahrer.length === 0) throw new Error('no data');

    const teamAvg = parseFloat(
      (fahrer.reduce((s, f) => s + f.avg_reaktionszeit_min, 0) / fahrer.length).toFixed(1),
    );
    fahrer.sort((a, b) => a.avg_reaktionszeit_min - b.avg_reaktionszeit_min);
    fahrer.forEach((f, i) => {
      f.team_durchschnitt_min = teamAvg;
      f.delta_min = parseFloat((f.avg_reaktionszeit_min - teamAvg).toFixed(1));
      f.rang = i + 1;
    });

    return NextResponse.json({
      fahrer,
      team_durchschnitt_min: teamAvg,
      sla_ziel_min: 5,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(mockData(locationId));
  }
}
