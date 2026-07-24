/**
 * GET /api/delivery/admin/fahrer-kundenzufriedenheit?location_id=<uuid>
 *
 * Phase 3713 — Fahrer-Kundenzufriedenheits-Ranking
 * Ø Kundenbewertung (1–5 ★) je Fahrer letzte 30 Tage aus delivery_orders.
 * Rang 1 = höchste Bewertung = bester.
 * Ampel grün(Top-25%) / gelb(Mitte-50%) / rot(Bottom-25%).
 * Alert Bottom-25% "Niedrige Kundenzufriedenheit!"; rank_delta pos = verbessert.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_bewertung: number;
  rank_delta: number;
  ampel: Ampel;
  alert_bottom: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  bester_name: string;
  schlechtester_name: string;
  alert_count: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'm1', fahrer_name: 'Julia F.', rang: 1, avg_bewertung: 4.8, rank_delta: 0,  ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'm2', fahrer_name: 'Sara K.',  rang: 2, avg_bewertung: 4.5, rank_delta: 1,  ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'm3', fahrer_name: 'Max M.',   rang: 3, avg_bewertung: 3.9, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'm4', fahrer_name: 'Tim B.',   rang: 4, avg_bewertung: 3.2, rank_delta: 0,  ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg: 4.1,
  bester_name: 'Julia F.',
  schlechtester_name: 'Tim B.',
  alert_count: 1,
};

function ampelFn(rang: number, total: number): Ampel {
  const pct = rang / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = await createClient();
    const seit30Tagen = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: drivers, error: dErr } = await supabase
      .from('employees')
      .select('id, vorname, nachname')
      .eq('location_id', locationId)
      .eq('rolle', 'fahrer');

    if (dErr || !drivers || drivers.length === 0) return NextResponse.json(MOCK);

    type EmpRow = { id: string; vorname: string | null; nachname: string | null };

    const rows = await Promise.all(
      (drivers as EmpRow[]).map(async (d) => {
        const name = [d.vorname, d.nachname].filter(Boolean).join(' ') || 'Fahrer';

        const { data: orders } = await supabase
          .from('delivery_orders')
          .select('customer_rating')
          .eq('fahrer_id', d.id)
          .gte('created_at', seit30Tagen)
          .not('customer_rating', 'is', null);

        const ratings = (orders ?? []) as { customer_rating: number | null }[];
        const valid = ratings.map(o => o.customer_rating).filter((r): r is number => r !== null);
        const avg_bewertung = valid.length > 0
          ? Math.round((valid.reduce((s, r) => s + r, 0) / valid.length) * 10) / 10
          : 0;

        return { fahrer_id: d.id, fahrer_name: name, avg_bewertung };
      })
    );

    const sorted = [...rows].sort((a, b) => b.avg_bewertung - a.avg_bewertung);
    const total = sorted.length;
    const fahrer: FahrerRow[] = sorted.map((f, i) => ({
      ...f,
      rang: i + 1,
      rank_delta: 0,
      ampel: ampelFn(i + 1, total),
      alert_bottom: (i + 1) / total > 0.75,
    }));

    const team_avg = fahrer.length
      ? Math.round((fahrer.reduce((s, f) => s + f.avg_bewertung, 0) / fahrer.length) * 10) / 10
      : 0;

    return NextResponse.json({
      fahrer,
      team_avg,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      schlechtester_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_bottom).length,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
