import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FahrerBenchmark = {
  fahrer_id: string;
  fahrer_name: string;
  stopps_pro_stunde: number;
  team_durchschnitt: number;
  delta_pct: number;
  bewertung_ø: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  touren_heute: number;
  verlauf: { stunde: string; stopps: number }[];
};

function mockData(locationId: string | null): { fahrer: FahrerBenchmark[]; team_ø_stopps_pro_h: number } {
  const fahrer: FahrerBenchmark[] = [
    {
      fahrer_id: 'f1', fahrer_name: 'Max M.', stopps_pro_stunde: 4.2, team_durchschnitt: 3.6,
      delta_pct: 16.7, bewertung_ø: 4.8, trend: 'besser', touren_heute: 5,
      verlauf: [
        { stunde: '10:00', stopps: 3 }, { stunde: '11:00', stopps: 5 },
        { stunde: '12:00', stopps: 4 }, { stunde: '13:00', stopps: 5 },
      ],
    },
    {
      fahrer_id: 'f2', fahrer_name: 'Tom K.', stopps_pro_stunde: 3.1, team_durchschnitt: 3.6,
      delta_pct: -13.9, bewertung_ø: 4.2, trend: 'schlechter', touren_heute: 3,
      verlauf: [
        { stunde: '10:00', stopps: 3 }, { stunde: '11:00', stopps: 3 },
        { stunde: '12:00', stopps: 4 }, { stunde: '13:00', stopps: 2 },
      ],
    },
    {
      fahrer_id: 'f3', fahrer_name: 'Lisa B.', stopps_pro_stunde: 3.7, team_durchschnitt: 3.6,
      delta_pct: 2.8, bewertung_ø: 4.6, trend: 'gleich', touren_heute: 4,
      verlauf: [
        { stunde: '10:00', stopps: 4 }, { stunde: '11:00', stopps: 3 },
        { stunde: '12:00', stopps: 4 }, { stunde: '13:00', stopps: 4 },
      ],
    },
  ];
  return { fahrer, team_ø_stopps_pro_h: 3.6 };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = createClient();

    const driversQ = supabase
      .from('mise_drivers')
      .select('id, full_name, location_id')
      .in('status', ['online', 'busy', 'delivering']);
    if (locationId) driversQ.eq('location_id', locationId);
    const { data: drivers, error: dErr } = await driversQ;
    if (dErr || !drivers || drivers.length === 0) throw new Error('no drivers');

    const today = new Date().toISOString().slice(0, 10);
    const { data: batches } = await supabase
      .from('mise_delivery_batches')
      .select('driver_id, stops_completed, stops_total, created_at, completed_at')
      .eq('status', 'completed')
      .gte('created_at', `${today}T00:00:00`);

    const teamStopps: number[] = [];
    const fahrerList: FahrerBenchmark[] = drivers.map((d) => {
      const mine = (batches ?? []).filter((b) => b.driver_id === d.id);
      const doneStopps = mine.reduce((s, b) => s + (b.stops_completed ?? 0), 0);
      const firstBatch = mine[0];
      let stunden = 1;
      if (firstBatch?.created_at) {
        stunden = Math.max(0.5, (Date.now() - new Date(firstBatch.created_at).getTime()) / 3_600_000);
      }
      const sph = parseFloat((doneStopps / stunden).toFixed(1));
      teamStopps.push(sph);

      const verlauf = mine.slice(-4).map((b) => ({
        stunde: new Date(b.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        stopps: b.stops_completed ?? 0,
      }));

      return {
        fahrer_id: d.id,
        fahrer_name: d.full_name ?? 'Fahrer',
        stopps_pro_stunde: sph,
        team_durchschnitt: 0,
        delta_pct: 0,
        bewertung_ø: 4.5,
        trend: 'gleich' as const,
        touren_heute: mine.length,
        verlauf,
      };
    });

    const teamØ = teamStopps.length
      ? parseFloat((teamStopps.reduce((a, b) => a + b, 0) / teamStopps.length).toFixed(1))
      : 3.5;

    for (const f of fahrerList) {
      f.team_durchschnitt = teamØ;
      f.delta_pct = teamØ > 0 ? parseFloat((((f.stopps_pro_stunde - teamØ) / teamØ) * 100).toFixed(1)) : 0;
      f.trend = f.delta_pct > 5 ? 'besser' : f.delta_pct < -5 ? 'schlechter' : 'gleich';
    }

    fahrerList.sort((a, b) => b.stopps_pro_stunde - a.stopps_pro_stunde);

    return NextResponse.json({
      fahrer: fahrerList,
      team_ø_stopps_pro_h: teamØ,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      ...mockData(locationId),
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    });
  }
}
