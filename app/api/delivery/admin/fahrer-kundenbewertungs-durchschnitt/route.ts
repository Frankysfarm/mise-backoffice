import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  bewertungs_avg: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  bester_name: string;
  niedrigste_name: string;
  alert_count: number;
  gesamt: number;
  ziel_avg: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, bewertungs_avg: 4.9, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, bewertungs_avg: 4.7, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, bewertungs_avg: 4.2, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, bewertungs_avg: 3.8, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg: 4.4,
  bester_name: 'Julia F.',
  niedrigste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel_avg: 4.5,
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
        const { data: ratings } = await supabase
          .from('delivery_ratings')
          .select('rating')
          .eq('driver_id', d.id)
          .gte('created_at', since);
        const ratingList = (ratings ?? []).map(r => r.rating).filter(v => typeof v === 'number');
        const bewertungs_avg =
          ratingList.length > 0
            ? Math.round((ratingList.reduce((s, v) => s + v, 0) / ratingList.length) * 10) / 10
            : 0;
        return { fahrer_id: d.id, fahrer_name: d.name, bewertungs_avg };
      }),
    );

    rows.sort((a, b) => b.bewertungs_avg - a.bewertungs_avg);

    const fahrer: FahrerRow[] = rows.map((r, i) => {
      const ampel = calcAmpel(i + 1, rows.length);
      return {
        ...r,
        rang: i + 1,
        rank_delta: 0,
        ampel,
        alert_niedrig: ampel === 'rot',
      };
    });

    const team_avg =
      fahrer.length
        ? Math.round((fahrer.reduce((s, f) => s + f.bewertungs_avg, 0) / fahrer.length) * 10) / 10
        : 0;

    if (driverId) {
      const me = fahrer.find(f => f.fahrer_id === driverId) ?? fahrer[0];
      return NextResponse.json({ fahrer_single: me, team_avg, gesamt: fahrer.length, ziel_avg: 4.5 });
    }

    return NextResponse.json({
      fahrer,
      team_avg,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      niedrigste_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_niedrig).length,
      gesamt: fahrer.length,
      ziel_avg: 4.5,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
