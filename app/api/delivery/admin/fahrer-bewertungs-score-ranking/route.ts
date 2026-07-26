import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_sterne: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_schlecht: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_sterne: number;
  bester_name: string;
  schlechtester_name: string;
  alert_count: number;
  gesamt: number;
  ziel_sterne: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, avg_sterne: 4.9, rank_delta:  0, ampel: 'gruen', alert_schlecht: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, avg_sterne: 4.5, rank_delta:  1, ampel: 'gruen', alert_schlecht: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, avg_sterne: 3.8, rank_delta: -1, ampel: 'gelb',  alert_schlecht: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_sterne: 2.9, rank_delta:  0, ampel: 'rot',   alert_schlecht: true  },
  ],
  team_avg_sterne: 4.0,
  bester_name: 'Max M.',
  schlechtester_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel_sterne: 4.0,
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
          .select('customer_rating')
          .eq('driver_id', d.id)
          .gte('created_at', since)
          .not('customer_rating', 'is', null);
        const valid = (tours ?? []).filter(t => t.customer_rating != null);
        const avg = valid.length
          ? Math.round((valid.reduce((s, t) => s + (t.customer_rating as number), 0) / valid.length) * 10) / 10
          : 0;
        return { fahrer_id: d.id, fahrer_name: d.name, avg_sterne: avg };
      }),
    );

    rows.sort((a, b) => b.avg_sterne - a.avg_sterne);

    const fahrer: FahrerRow[] = rows.map((r, i) => ({
      ...r,
      rang: i + 1,
      rank_delta: 0,
      ampel: calcAmpel(i + 1, rows.length),
      alert_schlecht: calcAmpel(i + 1, rows.length) === 'rot',
    }));

    const team_avg_sterne = fahrer.length
      ? Math.round((fahrer.reduce((s, f) => s + f.avg_sterne, 0) / fahrer.length) * 10) / 10
      : 0;

    if (driverId) {
      const me = fahrer.find(f => f.fahrer_id === driverId) ?? fahrer[0];
      return NextResponse.json({ fahrer_single: me, team_avg_sterne, ziel_sterne: 4.0 });
    }

    return NextResponse.json({
      fahrer,
      team_avg_sterne,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      schlechtester_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_schlecht).length,
      gesamt: fahrer.length,
      ziel_sterne: 4.0,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
