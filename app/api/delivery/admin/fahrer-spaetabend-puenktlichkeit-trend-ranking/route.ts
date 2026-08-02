import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Phase 5662 — Fahrer-Spätabend-Pünktlichkeits-Trend-Ranking (Batch 110)
// Verbesserung der Pünktlichkeitsquote in Spätabendschicht (20–24h UTC) letzter 30 Tage vs. vorherige 30 Tage
// puenktlichkeit_delta = aktuell_pct − vorher_pct (Prozentpunkte, % Lieferungen actual_delivery_at ≤ promised_delivery_at +5min)
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
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, puenktlichkeit_delta:  8.5, aktuell_pct: 91.0, vorher_pct: 82.5, rank_delta:  2, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, puenktlichkeit_delta:  4.2, aktuell_pct: 88.0, vorher_pct: 83.8, rank_delta:  0, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, puenktlichkeit_delta: -2.1, aktuell_pct: 79.0, vorher_pct: 81.1, rank_delta: -1, ampel: 'gelb',  alert_rueckfall: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, puenktlichkeit_delta: -7.3, aktuell_pct: 72.0, vorher_pct: 79.3, rank_delta: -2, ampel: 'rot',   alert_rueckfall: true  },
  ],
  team_avg_delta: 0.83,
  bester_name: 'Max M.',
  schwaechster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function assignAmpel(rang: number, gesamt: number): Ampel {
  const pct = rang / gesamt;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const sb = await createClient();
    const now = new Date();
    const d30  = new Date(now); d30.setDate(d30.getDate() - 30);
    const d60  = new Date(now); d60.setDate(d60.getDate() - 60);

    const d30s = d30.toISOString();
    const d60s = d60.toISOString();
    const d00s = now.toISOString();

    // Spätabend: 20–24h UTC
    const SPAET_START = 20;
    const SPAET_END   = 24;

    let query = sb
      .from('customer_orders')
      .select('fahrer_id, created_at, actual_delivery_at, promised_delivery_at, employees!inner(vorname, nachname, location_id)')
      .not('fahrer_id', 'is', null)
      .not('actual_delivery_at', 'is', null)
      .not('promised_delivery_at', 'is', null)
      .gte('created_at', d60s)
      .lte('created_at', d00s);

    if (locationId) {
      query = query.eq('employees.location_id', locationId);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      return NextResponse.json(MOCK);
    }

    type EmpRow = { vorname: string; nachname: string; location_id: string };

    // { fahrer_id -> { aktuell: { on_time, total }, vorher: { on_time, total } } }
    const aktuell: Record<string, { on_time: number; total: number }> = {};
    const vorher:  Record<string, { on_time: number; total: number }> = {};
    const names:   Record<string, string> = {};

    for (const row of data as Array<{
      fahrer_id: string;
      created_at: string;
      actual_delivery_at: string;
      promised_delivery_at: string;
      employees: EmpRow | EmpRow[];
    }>) {
      if (!row.fahrer_id || !row.created_at) continue;
      const emp = Array.isArray(row.employees) ? row.employees[0] : row.employees;
      if (!emp) continue;
      const h = new Date(row.created_at).getUTCHours();
      if (h < SPAET_START || h >= SPAET_END) continue;
      names[row.fahrer_id] = `${emp.vorname} ${emp.nachname[0]}.`;
      const isAktuell = new Date(row.created_at) >= d30;
      const bucket = isAktuell ? aktuell : vorher;
      if (!bucket[row.fahrer_id]) bucket[row.fahrer_id] = { on_time: 0, total: 0 };
      bucket[row.fahrer_id].total++;
      const actual   = new Date(row.actual_delivery_at).getTime();
      const promised = new Date(row.promised_delivery_at).getTime() + 5 * 60_000;
      if (actual <= promised) bucket[row.fahrer_id].on_time++;
    }

    const allIds = Array.from(new Set([...Object.keys(aktuell), ...Object.keys(vorher)]));
    if (allIds.length === 0) return NextResponse.json(MOCK);

    const rows: FahrerRow[] = allIds
      .map(id => {
        const a = aktuell[id] ?? { on_time: 0, total: 1 };
        const v = vorher[id]  ?? { on_time: 0, total: 1 };
        const aktuell_pct = Math.round((a.on_time / (a.total || 1)) * 10000) / 100;
        const vorher_pct  = Math.round((v.on_time / (v.total  || 1)) * 10000) / 100;
        return {
          fahrer_id: id,
          fahrer_name: names[id] ?? id,
          rang: 0,
          puenktlichkeit_delta: Math.round((aktuell_pct - vorher_pct) * 10) / 10,
          aktuell_pct,
          vorher_pct,
          rank_delta: 0,
          ampel: 'gelb' as Ampel,
          alert_rueckfall: false,
        };
      })
      .sort((a, b) => b.puenktlichkeit_delta - a.puenktlichkeit_delta);

    const gesamt = rows.length;
    rows.forEach((r, i) => {
      r.rang  = i + 1;
      r.ampel = assignAmpel(i + 1, gesamt);
      r.alert_rueckfall = r.puenktlichkeit_delta < -5.0;
    });

    const team_avg_delta = Math.round(
      rows.reduce((s, r) => s + r.puenktlichkeit_delta, 0) / gesamt * 10
    ) / 10;

    return NextResponse.json({
      fahrer: rows,
      team_avg_delta,
      bester_name:       rows[0]?.fahrer_name        ?? '',
      schwaechster_name: rows[gesamt - 1]?.fahrer_name ?? '',
      alert_count: rows.filter(r => r.alert_rueckfall).length,
      gesamt,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
