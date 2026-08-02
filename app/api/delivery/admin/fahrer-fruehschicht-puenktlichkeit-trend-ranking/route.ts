import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Phase 5634 — Fahrer-Frühschicht-Pünktlichkeits-Trend-Ranking (Batch 103)
// Verbesserung der Pünktlichkeitsquote in Frühschichten (06–12h UTC) letzter 30 Tage vs. vorherige 30 Tage
// puenktlichkeit_delta = aktuell_pct − vorher_pct (Prozentpunkte)
// ABSTEIGEND: größter positiver delta = Rang 1 = bester
// alert_rueckfall: puenktlichkeit_delta < -5.0

type Ampel = 'gruen' | 'gelb' | 'rot';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  puenktlichkeit_delta: number;
  aktuell_pct: number;
  vorher_pct: number;
  rank_delta: number;
  ampel: Ampel;
  alert_rueckfall: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_delta: number;
  bester_name: string;
  schwaechster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, puenktlichkeit_delta:  8.0, aktuell_pct: 94.0, vorher_pct: 86.0, rank_delta:  2, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, puenktlichkeit_delta:  5.0, aktuell_pct: 90.0, vorher_pct: 85.0, rank_delta: -1, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, puenktlichkeit_delta: -2.0, aktuell_pct: 78.0, vorher_pct: 80.0, rank_delta:  0, ampel: 'gelb',  alert_rueckfall: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, puenktlichkeit_delta: -7.0, aktuell_pct: 68.0, vorher_pct: 75.0, rank_delta: -1, ampel: 'rot',   alert_rueckfall: true  },
  ],
  team_avg_delta: 1.0,
  bester_name: 'Max M.',
  schwaechster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function assignAmpel(rang: number, gesamt: number): Ampel {
  const top    = Math.ceil(gesamt * 0.25);
  const bottom = Math.floor(gesamt * 0.75);
  if (rang <= top)   return 'gruen';
  if (rang > bottom) return 'rot';
  return 'gelb';
}

function isFruehschicht(isoStr: string): boolean {
  const h = new Date(isoStr).getUTCHours();
  return h >= 6 && h < 12;
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id')?.trim();
  const driverId   = req.nextUrl.searchParams.get('driver_id')?.trim();

  if (!locationId) return NextResponse.json(MOCK);

  try {
    const sb = await createClient();
    const now      = Date.now();
    const since60  = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString();
    const cutoff30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: drivers } = await sb
      .from('drivers')
      .select('id, vorname, nachname')
      .eq('location_id', locationId);

    const { data: tours } = await sb
      .from('delivery_tours')
      .select('driver_id, created_at, promised_delivery_at, actual_delivery_at')
      .eq('location_id', locationId)
      .eq('status', 'delivered')
      .gte('created_at', since60)
      .not('promised_delivery_at', 'is', null)
      .not('actual_delivery_at', 'is', null);

    if (!drivers || !tours || drivers.length === 0 || tours.length === 0) {
      return NextResponse.json(MOCK);
    }

    type Acc = { on_time: number; total: number };
    const recentAcc = new Map<string, Acc>();
    const prevAcc   = new Map<string, Acc>();

    for (const t of tours) {
      const id = t.driver_id as string;
      if (!id || !t.created_at) continue;
      if (!isFruehschicht(t.created_at as string)) continue;

      const isRecent   = (t.created_at as string) >= cutoff30;
      const actualMs   = new Date(t.actual_delivery_at as string).getTime();
      const promisedMs = new Date(t.promised_delivery_at as string).getTime();
      const onTime     = actualMs <= promisedMs + 5 * 60 * 1000; // +5 min Toleranz

      const map    = isRecent ? recentAcc : prevAcc;
      const prev   = map.get(id) ?? { on_time: 0, total: 0 };
      map.set(id, { on_time: prev.on_time + (onTime ? 1 : 0), total: prev.total + 1 });
    }

    if (recentAcc.size === 0) return NextResponse.json(MOCK);

    type Candidate = {
      fahrer_id: string;
      fahrer_name: string;
      puenktlichkeit_delta: number;
      aktuell_pct: number;
      vorher_pct: number;
    };

    const driverMap = new Map(
      (drivers ?? []).map(d => [d.id as string, `${d.vorname ?? ''} ${d.nachname ?? ''}`.trim() || 'Fahrer']),
    );

    const candidates: Candidate[] = [];
    for (const [id, acc] of recentAcc.entries()) {
      if (acc.total === 0) continue;
      const aktuell = Math.round((acc.on_time / acc.total) * 1000) / 10;
      const pAcc    = prevAcc.get(id);
      const vorher  = pAcc && pAcc.total > 0
        ? Math.round((pAcc.on_time / pAcc.total) * 1000) / 10
        : aktuell;
      const delta   = Math.round((aktuell - vorher) * 10) / 10;

      candidates.push({
        fahrer_id:            id,
        fahrer_name:          driverMap.get(id) ?? id.slice(0, 8),
        puenktlichkeit_delta: delta,
        aktuell_pct:          aktuell,
        vorher_pct:           vorher,
      });
    }

    if (candidates.length === 0) return NextResponse.json(MOCK);

    // ABSTEIGEND: größter positiver delta = Rang 1 = bester
    candidates.sort((a, b) => b.puenktlichkeit_delta - a.puenktlichkeit_delta);
    const gesamt    = candidates.length;
    const teamDelta = Math.round(
      (candidates.reduce((s, c) => s + c.puenktlichkeit_delta, 0) / gesamt) * 10,
    ) / 10;

    let fahrer: FahrerRow[] = candidates.map((c, i) => ({
      fahrer_id:            c.fahrer_id,
      fahrer_name:          c.fahrer_name,
      rang:                 i + 1,
      puenktlichkeit_delta: c.puenktlichkeit_delta,
      aktuell_pct:          c.aktuell_pct,
      vorher_pct:           c.vorher_pct,
      rank_delta:           0,
      ampel:                assignAmpel(i + 1, gesamt),
      alert_rueckfall:      c.puenktlichkeit_delta < -5.0,
    }));

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK);

    return NextResponse.json({
      fahrer,
      team_avg_delta:   teamDelta,
      bester_name:      candidates[0]?.fahrer_name     ?? '—',
      schwaechster_name: candidates[gesamt - 1]?.fahrer_name ?? '—',
      alert_count:      fahrer.filter(f => f.alert_rueckfall).length,
      gesamt,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
