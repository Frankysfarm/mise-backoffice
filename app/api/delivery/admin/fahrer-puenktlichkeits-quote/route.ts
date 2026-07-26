import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  puenktlichkeits_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_verspaetet: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  bester_name: string;
  niedrigste_name: string;
  alert_count: number;
  gesamt: number;
  ziel_pct: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, puenktlichkeits_pct: 92, rank_delta:  1, ampel: 'gruen', alert_verspaetet: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, puenktlichkeits_pct: 85, rank_delta:  0, ampel: 'gruen', alert_verspaetet: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, puenktlichkeits_pct: 74, rank_delta: -1, ampel: 'gelb',  alert_verspaetet: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, puenktlichkeits_pct: 58, rank_delta:  0, ampel: 'rot',   alert_verspaetet: true  },
  ],
  team_avg_pct: 77,
  bester_name: 'Julia F.',
  niedrigste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel_pct: 85,
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
        const { data: tours, count: total } = await supabase
          .from('delivery_tours')
          .select('actual_delivery_time, estimated_delivery_time', { count: 'exact' })
          .eq('driver_id', d.id)
          .gte('created_at', since)
          .not('actual_delivery_time', 'is', null)
          .not('estimated_delivery_time', 'is', null);
        const totalCount = total ?? 0;
        const onTimeCount = (tours ?? []).filter(
          t => new Date(t.actual_delivery_time) <= new Date(t.estimated_delivery_time),
        ).length;
        const puenktlichkeits_pct = totalCount > 0 ? Math.round((onTimeCount / totalCount) * 100) : 0;
        return { fahrer_id: d.id, fahrer_name: d.name, puenktlichkeits_pct };
      }),
    );

    rows.sort((a, b) => b.puenktlichkeits_pct - a.puenktlichkeits_pct);

    const fahrer: FahrerRow[] = rows.map((r, i) => {
      const ampel = calcAmpel(i + 1, rows.length);
      return {
        ...r,
        rang: i + 1,
        rank_delta: 0,
        ampel,
        alert_verspaetet: ampel === 'rot',
      };
    });

    const team_avg_pct = fahrer.length
      ? Math.round(fahrer.reduce((s, f) => s + f.puenktlichkeits_pct, 0) / fahrer.length)
      : 0;

    if (driverId) {
      const me = fahrer.find(f => f.fahrer_id === driverId) ?? fahrer[0];
      return NextResponse.json({ fahrer_single: me, team_avg_pct, gesamt: fahrer.length, ziel_pct: 85 });
    }

    return NextResponse.json({
      fahrer,
      team_avg_pct,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      niedrigste_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_verspaetet).length,
      gesamt: fahrer.length,
      ziel_pct: 85,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
