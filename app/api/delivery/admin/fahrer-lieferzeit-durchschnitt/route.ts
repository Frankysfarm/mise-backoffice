import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_lang: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_min: number;
  bester_name: string;
  laengste_name: string;
  alert_count: number;
  gesamt: number;
  ziel_min: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_min: 18, rank_delta: -1, ampel: 'gruen', alert_lang: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_min: 22, rank_delta:  0, ampel: 'gruen', alert_lang: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, avg_min: 28, rank_delta:  1, ampel: 'gelb',  alert_lang: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_min: 36, rank_delta:  0, ampel: 'rot',   alert_lang: true  },
  ],
  team_avg_min: 26,
  bester_name: 'Julia F.',
  laengste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel_min: 25,
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
          .select('duration_minutes')
          .eq('driver_id', d.id)
          .gte('created_at', since)
          .not('duration_minutes', 'is', null);

        const vals = (tours ?? []).map(t => t.duration_minutes as number).filter(v => v > 0);
        const avg_min = vals.length > 0 ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
        return { fahrer_id: d.id, fahrer_name: d.name, avg_min };
      }),
    );

    rows.sort((a, b) => a.avg_min - b.avg_min);

    const fahrer: FahrerRow[] = rows.map((r, i) => {
      const ampel = calcAmpel(i + 1, rows.length);
      return {
        ...r,
        rang: i + 1,
        rank_delta: 0,
        ampel,
        alert_lang: ampel === 'rot',
      };
    });

    const team_avg_min = fahrer.length
      ? Math.round(fahrer.reduce((s, f) => s + f.avg_min, 0) / fahrer.length)
      : 0;

    if (driverId) {
      const me = fahrer.find(f => f.fahrer_id === driverId) ?? fahrer[0];
      return NextResponse.json({ fahrer_single: me, team_avg_min, gesamt: fahrer.length, ziel_min: 25 });
    }

    return NextResponse.json({
      fahrer,
      team_avg_min,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      laengste_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_lang).length,
      gesamt: fahrer.length,
      ziel_min: 25,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
