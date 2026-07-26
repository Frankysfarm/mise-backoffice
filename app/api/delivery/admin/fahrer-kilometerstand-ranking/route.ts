import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  gesamt_km: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_wenig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_km: number;
  meister_name: string;
  wenigster_name: string;
  alert_count: number;
  gesamt: number;
  ziel_km: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, gesamt_km: 1240, rank_delta:  1, ampel: 'gruen', alert_wenig: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, gesamt_km: 1080, rank_delta:  0, ampel: 'gruen', alert_wenig: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, gesamt_km:  890, rank_delta: -1, ampel: 'gelb',  alert_wenig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, gesamt_km:  620, rank_delta:  0, ampel: 'rot',   alert_wenig: true  },
  ],
  team_avg_km: 957,
  meister_name: 'Julia F.',
  wenigster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel_km: 800,
};

function calcAmpel(rank: number, total: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rank / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const locationId = searchParams.get('location_id');
  const driverId = searchParams.get('driver_id');

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
          .select('distance_km')
          .eq('driver_id', d.id)
          .gte('created_at', since)
          .not('distance_km', 'is', null);
        const gesamt_km = Math.round(
          (tours ?? []).reduce((s, t) => s + (t.distance_km ?? 0), 0),
        );
        return { fahrer_id: d.id, fahrer_name: d.name, gesamt_km };
      }),
    );

    rows.sort((a, b) => b.gesamt_km - a.gesamt_km);

    const fahrer: FahrerRow[] = rows.map((r, i) => {
      const ampel = calcAmpel(i + 1, rows.length);
      return {
        ...r,
        rang: i + 1,
        rank_delta: 0,
        ampel,
        alert_wenig: ampel === 'rot',
      };
    });

    const team_avg_km = fahrer.length
      ? Math.round(fahrer.reduce((s, f) => s + f.gesamt_km, 0) / fahrer.length)
      : 0;

    if (driverId) {
      const me = fahrer.find(f => f.fahrer_id === driverId) ?? fahrer[0];
      return NextResponse.json({ fahrer_single: me, team_avg_km, gesamt: fahrer.length, ziel_km: 800 });
    }

    return NextResponse.json({
      fahrer,
      team_avg_km,
      meister_name: fahrer[0]?.fahrer_name ?? '',
      wenigster_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_wenig).length,
      gesamt: fahrer.length,
      ziel_km: 800,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
