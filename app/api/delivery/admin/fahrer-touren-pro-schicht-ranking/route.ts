import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  touren_pro_schicht: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_wenig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  bester_name: string;
  wenigster_name: string;
  alert_count: number;
  gesamt: number;
  ziel: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, touren_pro_schicht: 8.5, rank_delta:  1, ampel: 'gruen', alert_wenig: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, touren_pro_schicht: 7.2, rank_delta:  0, ampel: 'gruen', alert_wenig: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, touren_pro_schicht: 5.8, rank_delta: -1, ampel: 'gelb',  alert_wenig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, touren_pro_schicht: 3.9, rank_delta:  0, ampel: 'rot',   alert_wenig: true  },
  ],
  team_avg: 6.35,
  bester_name: 'Julia F.',
  wenigster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel: 6.0,
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
        const { count: tourCount } = await supabase
          .from('delivery_tours')
          .select('id', { count: 'exact', head: true })
          .eq('driver_id', d.id)
          .gte('created_at', since);

        const { count: schichtCount } = await supabase
          .from('delivery_shifts')
          .select('id', { count: 'exact', head: true })
          .eq('driver_id', d.id)
          .gte('started_at', since);

        const shifts = schichtCount ?? 0;
        const tours = tourCount ?? 0;
        const touren_pro_schicht = shifts > 0
          ? Math.round((tours / shifts) * 10) / 10
          : 0;

        return { fahrer_id: d.id, fahrer_name: d.name, touren_pro_schicht };
      }),
    );

    rows.sort((a, b) => b.touren_pro_schicht - a.touren_pro_schicht);

    const fahrer: FahrerRow[] = rows.map((r, i) => ({
      ...r,
      rang: i + 1,
      rank_delta: 0,
      ampel: calcAmpel(i + 1, rows.length),
      alert_wenig: calcAmpel(i + 1, rows.length) === 'rot',
    }));

    const team_avg =
      fahrer.length
        ? Math.round(
            (fahrer.reduce((s, f) => s + f.touren_pro_schicht, 0) / fahrer.length) * 10,
          ) / 10
        : 0;

    if (driverId) {
      const me = fahrer.find(f => f.fahrer_id === driverId) ?? fahrer[0];
      return NextResponse.json({ fahrer_single: me, team_avg, gesamt: fahrer.length, ziel: 6.0 });
    }

    return NextResponse.json({
      fahrer,
      team_avg,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      wenigster_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_wenig).length,
      gesamt: fahrer.length,
      ziel: 6.0,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
