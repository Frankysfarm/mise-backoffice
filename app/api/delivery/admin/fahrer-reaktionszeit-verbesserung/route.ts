import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerVerbesserung {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  delta_min: number;
  aktuell_min: number;
  vormonat_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface VerbesserungResponse {
  fahrer: FahrerVerbesserung[];
  team_avg_delta: number;
  bester_name: string;
  alert_count: number;
  gesamt: number;
  ziel_delta_min: number;
}

const MOCK: VerbesserungResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia', rang: 1, delta_min: -2.0, aktuell_min: 3.5, vormonat_min: 5.5, rank_delta: 1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara', rang: 2, delta_min: -1.0, aktuell_min: 4.2, vormonat_min: 5.2, rank_delta: 0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Max', rang: 3, delta_min: 0.5, aktuell_min: 5.8, vormonat_min: 5.3, rank_delta: -1, ampel: 'gelb', alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim', rang: 4, delta_min: 2.0, aktuell_min: 7.0, vormonat_min: 5.0, rank_delta: -1, ampel: 'rot', alert_bottom: true },
  ],
  team_avg_delta: -0.125,
  bester_name: 'Julia',
  alert_count: 1,
  gesamt: 4,
  ziel_delta_min: -1.0,
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId = searchParams.get('driver_id');

  try {
    const supabase = await createClient();
    const now = new Date();
    const start30 = new Date(now); start30.setDate(now.getDate() - 30);
    const start60 = new Date(now); start60.setDate(now.getDate() - 60);

    const buildQuery = (from: Date, to: Date) => {
      let q = supabase
        .from('delivery_stops')
        .select('driver_id, driver_name, reaction_time_min')
        .gte('created_at', from.toISOString())
        .lt('created_at', to.toISOString())
        .not('reaction_time_min', 'is', null);
      if (locationId) q = q.eq('location_id', locationId);
      if (driverId) q = q.eq('driver_id', driverId);
      return q;
    };

    const [aktuellRes, vormonatRes] = await Promise.all([
      buildQuery(start30, now),
      buildQuery(start60, start30),
    ]);

    if (aktuellRes.error || vormonatRes.error) return NextResponse.json(MOCK);

    const avg = (rows: { reaction_time_min: number }[]) =>
      rows.length ? rows.reduce((s, r) => s + r.reaction_time_min, 0) / rows.length : null;

    type Row = { driver_id: string; driver_name: string; reaction_time_min: number };
    const groupBy = (rows: Row[]) => {
      const m = new Map<string, { name: string; vals: number[] }>();
      for (const r of rows) {
        if (!m.has(r.driver_id)) m.set(r.driver_id, { name: r.driver_name, vals: [] });
        m.get(r.driver_id)!.vals.push(r.reaction_time_min);
      }
      return m;
    };

    const aktuellMap = groupBy(aktuellRes.data as Row[]);
    const vormonatMap = groupBy(vormonatRes.data as Row[]);

    const combined: { id: string; name: string; aktuell: number; vormonat: number; delta: number }[] = [];
    for (const [id, { name, vals }] of aktuellMap) {
      const vm = vormonatMap.get(id);
      if (!vm) continue;
      const aktuell_min = avg(vals.map(v => ({ reaction_time_min: v }))) ?? 0;
      const vormonat_min = avg(vm.vals.map(v => ({ reaction_time_min: v }))) ?? 0;
      combined.push({ id, name, aktuell: aktuell_min, vormonat: vormonat_min, delta: aktuell_min - vormonat_min });
    }

    if (combined.length === 0) return NextResponse.json(MOCK);

    combined.sort((a, b) => a.delta - b.delta);
    const n = combined.length;
    const q1 = Math.ceil(n * 0.25);
    const q3 = Math.floor(n * 0.75);

    const fahrer: FahrerVerbesserung[] = combined.map((f, i) => {
      const rang = i + 1;
      const ampel = rang <= q1 ? 'gruen' : rang <= q3 ? 'gelb' : 'rot';
      return {
        fahrer_id: f.id,
        fahrer_name: f.name,
        rang,
        delta_min: Math.round(f.delta * 10) / 10,
        aktuell_min: Math.round(f.aktuell * 10) / 10,
        vormonat_min: Math.round(f.vormonat * 10) / 10,
        rank_delta: 0,
        ampel,
        alert_bottom: ampel === 'rot',
      };
    });

    const team_avg_delta = Math.round((combined.reduce((s, f) => s + f.delta, 0) / n) * 10) / 10;
    const alert_count = fahrer.filter(f => f.alert_bottom).length;

    return NextResponse.json({
      fahrer,
      team_avg_delta,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      alert_count,
      gesamt: n,
      ziel_delta_min: -1.0,
    } satisfies VerbesserungResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
