import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Phase 5670 — Fahrer-Abendschicht-Pünktlichkeits-Trend-Ranking (Batch 112)
// Verbesserung der Pünktlichkeitsquote in Abendschichten (17–20h UTC) letzter 30 Tage vs. vorherige 30 Tage
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
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, puenktlichkeit_delta:  7.2, aktuell_pct: 89.0, vorher_pct: 81.8, rank_delta:  1, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, puenktlichkeit_delta:  3.1, aktuell_pct: 85.0, vorher_pct: 81.9, rank_delta:  0, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, puenktlichkeit_delta: -1.8, aktuell_pct: 78.0, vorher_pct: 79.8, rank_delta: -1, ampel: 'gelb',  alert_rueckfall: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, puenktlichkeit_delta: -6.4, aktuell_pct: 71.0, vorher_pct: 77.4, rank_delta: -1, ampel: 'rot',   alert_rueckfall: true  },
  ],
  team_avg_delta: 0.53,
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

    // Abendschicht: 17–20h UTC
    const ABEND_START = 17;
    const ABEND_END   = 20;

    let query = sb
      .from('customer_orders')
      .select('fahrer_id, created_at, actual_delivery_at, promised_delivery_at, employees!inner(vorname, nachname, location_id)')
      .not('fahrer_id', 'is', null)
      .not('actual_delivery_at', 'is', null)
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

    const aktuell: Record<string, { puenktlich: number; gesamt: number }> = {};
    const vorher:  Record<string, { puenktlich: number; gesamt: number }> = {};
    const names:   Record<string, string> = {};

    for (const row of data as Array<{
      fahrer_id: string;
      created_at: string;
      actual_delivery_at: string;
      promised_delivery_at: string;
      employees: EmpRow | EmpRow[];
    }>) {
      if (!row.fahrer_id || !row.created_at || !row.actual_delivery_at) continue;
      const emp = Array.isArray(row.employees) ? row.employees[0] : row.employees;
      if (!emp) continue;
      const h = new Date(row.created_at).getUTCHours();
      if (h < ABEND_START || h >= ABEND_END) continue;
      names[row.fahrer_id] = `${emp.vorname} ${emp.nachname[0]}.`;
      const promised = row.promised_delivery_at
        ? new Date(row.promised_delivery_at).getTime() + 5 * 60_000
        : new Date(row.created_at).getTime() + 45 * 60_000;
      const actual   = new Date(row.actual_delivery_at).getTime();
      const onTime   = actual <= promised ? 1 : 0;
      const bucket   = new Date(row.created_at) >= d30 ? aktuell : vorher;
      if (!bucket[row.fahrer_id]) bucket[row.fahrer_id] = { puenktlich: 0, gesamt: 0 };
      bucket[row.fahrer_id].puenktlich += onTime;
      bucket[row.fahrer_id].gesamt++;
    }

    const allIds = Array.from(new Set([...Object.keys(aktuell), ...Object.keys(vorher)]));
    if (allIds.length === 0) return NextResponse.json(MOCK);

    const rows: FahrerRow[] = allIds
      .map(id => {
        const a = aktuell[id] ?? { puenktlich: 0, gesamt: 0 };
        const v = vorher[id]  ?? { puenktlich: 0, gesamt: 0 };
        const aktuell_pct = a.gesamt > 0 ? (a.puenktlich / a.gesamt) * 100 : 0;
        const vorher_pct  = v.gesamt > 0 ? (v.puenktlich / v.gesamt) * 100 : 0;
        return {
          fahrer_id: id,
          fahrer_name: names[id] ?? id,
          rang: 0,
          puenktlichkeit_delta: Math.round((aktuell_pct - vorher_pct) * 10) / 10,
          aktuell_pct: Math.round(aktuell_pct * 10) / 10,
          vorher_pct:  Math.round(vorher_pct  * 10) / 10,
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

    const team_avg_delta = Math.round(rows.reduce((s, r) => s + r.puenktlichkeit_delta, 0) / gesamt * 10) / 10;

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
