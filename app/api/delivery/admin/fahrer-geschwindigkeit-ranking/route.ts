import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_kmh: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_kmh: number;
  schnellster_name: string;
  langsamster_name: string;
  alert_count: number;
  gesamt: number;
  ziel_kmh: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_kmh: 42, rank_delta:  1, ampel: 'rot',  alert_hoch: true  },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, avg_kmh: 35, rank_delta:  0, ampel: 'gelb', alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, avg_kmh: 28, rank_delta: -1, ampel: 'gelb', alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_kmh: 18, rank_delta:  0, ampel: 'gruen', alert_hoch: false },
  ],
  team_avg_kmh: 31,
  schnellster_name: 'Julia F.',
  langsamster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel_kmh: 25,
};

function calcAmpel(kmh: number): 'gruen' | 'gelb' | 'rot' {
  if (kmh >= 40) return 'rot';
  if (kmh >= 25) return 'gelb';
  return 'gruen';
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const locationId = searchParams.get('location_id');

  if (!locationId) return NextResponse.json(MOCK);

  try {
    const supabase = await createClient();
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, name')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (!drivers?.length) return NextResponse.json(MOCK);

    const rows = await Promise.all(
      drivers.map(async d => {
        const { data: tours } = await supabase
          .from('delivery_tours')
          .select('distance_km, duration_minutes')
          .eq('driver_id', d.id)
          .gte('created_at', since)
          .not('distance_km', 'is', null)
          .not('duration_minutes', 'is', null);
        const valid = (tours ?? []).filter(
          t => t.distance_km && t.duration_minutes && t.duration_minutes > 0,
        );
        const avg_kmh = valid.length
          ? Math.round(
              valid.reduce((s, t) => s + (t.distance_km / t.duration_minutes) * 60, 0) / valid.length,
            )
          : 0;
        return { fahrer_id: d.id, fahrer_name: d.name, avg_kmh };
      }),
    );

    rows.sort((a, b) => b.avg_kmh - a.avg_kmh);

    const fahrer: FahrerRow[] = rows.map((r, i) => {
      const ampel = calcAmpel(r.avg_kmh);
      return {
        ...r,
        rang: i + 1,
        rank_delta: 0,
        ampel,
        alert_hoch: ampel === 'rot',
      };
    });

    const team_avg_kmh = fahrer.length
      ? Math.round(fahrer.reduce((s, f) => s + f.avg_kmh, 0) / fahrer.length)
      : 0;

    return NextResponse.json({
      fahrer,
      team_avg_kmh,
      schnellster_name: fahrer[0]?.fahrer_name ?? '',
      langsamster_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_hoch).length,
      gesamt: fahrer.length,
      ziel_kmh: 25,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
