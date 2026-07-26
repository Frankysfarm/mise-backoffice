import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_tip_eur: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_eur: number;
  bester_name: string;
  niedrigster_name: string;
  alert_count: number;
  gesamt: number;
  ziel_eur: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, avg_tip_eur: 3.50, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, avg_tip_eur: 2.80, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, avg_tip_eur: 1.60, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_tip_eur: 0.80, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_eur: 2.18,
  bester_name: 'Max M.',
  niedrigster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel_eur: 2.00,
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
          .select('tip_amount')
          .eq('driver_id', d.id)
          .gte('created_at', since)
          .not('tip_amount', 'is', null);
        const tips = tours ?? [];
        const avg = tips.length
          ? Math.round((tips.reduce((s, t) => s + (t.tip_amount ?? 0), 0) / tips.length) * 100) / 100
          : 0;
        return { fahrer_id: d.id, fahrer_name: d.name, avg_tip_eur: avg };
      }),
    );

    rows.sort((a, b) => b.avg_tip_eur - a.avg_tip_eur);

    const fahrer: FahrerRow[] = rows.map((r, i) => ({
      ...r,
      rang: i + 1,
      rank_delta: 0,
      ampel: calcAmpel(i + 1, rows.length),
      alert_niedrig: calcAmpel(i + 1, rows.length) === 'rot',
    }));

    const team_avg_eur = fahrer.length
      ? Math.round((fahrer.reduce((s, f) => s + f.avg_tip_eur, 0) / fahrer.length) * 100) / 100
      : 0;

    if (driverId) {
      const me = fahrer.find(f => f.fahrer_id === driverId) ?? fahrer[0];
      return NextResponse.json({ fahrer_single: me, team_avg_eur, ziel_eur: 2.00 });
    }

    return NextResponse.json({
      fahrer,
      team_avg_eur,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      niedrigster_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_niedrig).length,
      gesamt: fahrer.length,
      ziel_eur: 2.00,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
