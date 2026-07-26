import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_reaktionszeit_sek: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_langsam: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_sek: number;
  bester_name: string;
  langsamster_name: string;
  alert_count: number;
  gesamt: number;
  ziel_sek: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_reaktionszeit_sek:  45, rank_delta: -1, ampel: 'gruen', alert_langsam: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_reaktionszeit_sek:  72, rank_delta:  0, ampel: 'gruen', alert_langsam: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, avg_reaktionszeit_sek:  95, rank_delta:  1, ampel: 'gelb',  alert_langsam: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_reaktionszeit_sek: 138, rank_delta:  0, ampel: 'rot',   alert_langsam: true  },
  ],
  team_avg_sek: 87,
  bester_name: 'Julia F.',
  langsamster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel_sek: 60,
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
          .select('accepted_at, created_at')
          .eq('driver_id', d.id)
          .gte('created_at', since)
          .not('accepted_at', 'is', null);
        const valid = (tours ?? []).filter(t => t.accepted_at && t.created_at);
        const avg = valid.length
          ? Math.round(
              valid.reduce((s, t) => {
                const diff = (new Date(t.accepted_at).getTime() - new Date(t.created_at).getTime()) / 1000;
                return s + Math.max(0, diff);
              }, 0) / valid.length,
            )
          : 0;
        return { fahrer_id: d.id, fahrer_name: d.name, avg_reaktionszeit_sek: avg };
      }),
    );

    rows.sort((a, b) => a.avg_reaktionszeit_sek - b.avg_reaktionszeit_sek);

    const fahrer: FahrerRow[] = rows.map((r, i) => ({
      ...r,
      rang: i + 1,
      rank_delta: 0,
      ampel: calcAmpel(i + 1, rows.length),
      alert_langsam: calcAmpel(i + 1, rows.length) === 'rot',
    }));

    const team_avg_sek = fahrer.length
      ? Math.round(fahrer.reduce((s, f) => s + f.avg_reaktionszeit_sek, 0) / fahrer.length)
      : 0;

    if (driverId) {
      const me = fahrer.find(f => f.fahrer_id === driverId) ?? fahrer[0];
      return NextResponse.json({ fahrer_single: me, team_avg_sek, ziel_sek: 60 });
    }

    return NextResponse.json({
      fahrer,
      team_avg_sek,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      langsamster_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_langsam).length,
      gesamt: fahrer.length,
      ziel_sek: 60,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
