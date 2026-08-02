import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Phase 5642 — Fahrer-Wochenend-Effizienz-Trend-Ranking (Batch 105)
// Verbesserung der Liefereffizienz in Wochenendschichten (Sa/So) letzter 30 Tage vs. vorherige 30 Tage
// effizienz_delta = aktuell_touren_pro_std − vorher_touren_pro_std
// ABSTEIGEND: größter positiver delta = Rang 1 = bester
// alert_rueckfall: effizienz_delta < -0.3

type Ampel = 'gruen' | 'gelb' | 'rot';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  effizienz_delta: number;
  aktuell_touren_pro_std: number;
  vorher_touren_pro_std: number;
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
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, effizienz_delta:  0.7, aktuell_touren_pro_std: 3.5, vorher_touren_pro_std: 2.8, rank_delta:  1, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, effizienz_delta:  0.4, aktuell_touren_pro_std: 3.1, vorher_touren_pro_std: 2.7, rank_delta:  0, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, effizienz_delta: -0.1, aktuell_touren_pro_std: 2.5, vorher_touren_pro_std: 2.6, rank_delta: -1, ampel: 'gelb',  alert_rueckfall: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, effizienz_delta: -0.5, aktuell_touren_pro_std: 2.1, vorher_touren_pro_std: 2.6, rank_delta: -1, ampel: 'rot',   alert_rueckfall: true  },
  ],
  team_avg_delta: 0.125,
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

// Sa=6, So=0 in UTC getDay()
function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr).getUTCDay();
  return day === 0 || day === 6;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id');

  try {
    const sb = await createClient();
    const now = new Date();
    const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
    const d60 = new Date(now); d60.setDate(d60.getDate() - 60);

    const d60s = d60.toISOString();
    const d00s = now.toISOString();
    const d30s = d30.toISOString();

    let query = sb
      .from('customer_orders')
      .select('fahrer_id, created_at, abgeliefert_at, employees!inner(vorname, nachname, location_id)')
      .not('fahrer_id', 'is', null)
      .not('abgeliefert_at', 'is', null)
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

    const aktuell: Record<string, { touren: number; stunden: Set<string> }> = {};
    const vorher:  Record<string, { touren: number; stunden: Set<string> }> = {};
    const names:   Record<string, string> = {};

    for (const row of data as Array<{
      fahrer_id: string;
      created_at: string;
      abgeliefert_at: string;
      employees: EmpRow | EmpRow[];
    }>) {
      if (!row.fahrer_id || !row.created_at) continue;
      if (!isWeekend(row.created_at)) continue;
      const emp = Array.isArray(row.employees) ? row.employees[0] : row.employees;
      if (!emp) continue;
      const dateKey = row.created_at.slice(0, 10);
      const h = new Date(row.created_at).getUTCHours();
      const hourKey = `${dateKey}T${String(h).padStart(2, '0')}`;
      names[row.fahrer_id] = `${emp.vorname} ${emp.nachname[0]}.`;
      const bucket = new Date(row.created_at) >= d30 ? aktuell : vorher;
      if (!bucket[row.fahrer_id]) bucket[row.fahrer_id] = { touren: 0, stunden: new Set() };
      bucket[row.fahrer_id].touren++;
      bucket[row.fahrer_id].stunden.add(hourKey);
    }

    const allIds = Array.from(new Set([...Object.keys(aktuell), ...Object.keys(vorher)]));
    if (allIds.length === 0) return NextResponse.json(MOCK);

    const rows: FahrerRow[] = allIds
      .map(id => {
        const a = aktuell[id] ?? { touren: 0, stunden: new Set() };
        const v = vorher[id]  ?? { touren: 0, stunden: new Set() };
        const aktuell_std = a.stunden.size || 1;
        const vorher_std  = v.stunden.size || 1;
        const aktuell_tps = a.touren / aktuell_std;
        const vorher_tps  = v.touren / vorher_std;
        return {
          fahrer_id: id,
          fahrer_name: names[id] ?? id,
          rang: 0,
          effizienz_delta: Math.round((aktuell_tps - vorher_tps) * 100) / 100,
          aktuell_touren_pro_std: Math.round(aktuell_tps * 100) / 100,
          vorher_touren_pro_std:  Math.round(vorher_tps  * 100) / 100,
          rank_delta: 0,
          ampel: 'gelb' as Ampel,
          alert_rueckfall: false,
        };
      })
      .sort((a, b) => b.effizienz_delta - a.effizienz_delta);

    const gesamt = rows.length;
    rows.forEach((r, i) => {
      r.rang  = i + 1;
      r.ampel = assignAmpel(i + 1, gesamt);
      r.alert_rueckfall = r.effizienz_delta < -0.3;
    });

    const team_avg_delta = Math.round(rows.reduce((s, r) => s + r.effizienz_delta, 0) / gesamt * 100) / 100;

    return NextResponse.json({
      fahrer: rows,
      team_avg_delta,
      bester_name:       rows[0]?.fahrer_name           ?? '',
      schwaechster_name: rows[gesamt - 1]?.fahrer_name  ?? '',
      alert_count: rows.filter(r => r.alert_rueckfall).length,
      gesamt,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
