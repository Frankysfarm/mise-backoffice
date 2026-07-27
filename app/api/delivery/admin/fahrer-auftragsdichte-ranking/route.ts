import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface TourRow { driver_id: string; driver_name: string; created_at: string; delivered_at: string | null; completed_at: string | null; }
interface ShiftRow { driver_id: string; started_at: string; ended_at: string | null; }

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  dichte: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  dichtester_name: string;
  niedrigster_name: string;
  alert_count: number;
  gesamt: number;
  ziel: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, dichte: 4.2, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, dichte: 3.8, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, dichte: 3.1, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, dichte: 2.4, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg: 3.4,
  dichtester_name: 'Julia F.',
  niedrigster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel: 4.0,
};

function ampelColor(rank: number, total: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rank / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

function thirtyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString();
}

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString();
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const location_id = searchParams.get('location_id');

  if (!location_id) return NextResponse.json(MOCK);

  const supabase = await createClient();

  try {
    const since30 = thirtyDaysAgo();
    const sinceYest = yesterday();

    const [toursRes, shiftsRes, toursYestRes, shiftsYestRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, driver_name, created_at, delivered_at, completed_at')
        .eq('location_id', location_id)
        .gte('created_at', since30),
      supabase
        .from('driver_shifts')
        .select('driver_id, started_at, ended_at')
        .eq('location_id', location_id)
        .gte('started_at', since30),
      supabase
        .from('delivery_tours')
        .select('driver_id, driver_name, created_at, delivered_at, completed_at')
        .eq('location_id', location_id)
        .gte('created_at', sinceYest),
      supabase
        .from('driver_shifts')
        .select('driver_id, started_at, ended_at')
        .eq('location_id', location_id)
        .gte('started_at', sinceYest),
    ]);

    const tours: TourRow[] = toursRes.data ?? [];
    const shifts: ShiftRow[] = shiftsRes.data ?? [];
    if (tours.length === 0) return NextResponse.json(MOCK);

    function computeDichte(ts: TourRow[], ss: ShiftRow[]): Record<string, { name: string; count: number; hours: number }> {
      const toursByDriver: Record<string, number> = {};
      const nameMap: Record<string, string> = {};
      for (const t of ts) {
        toursByDriver[t.driver_id] = (toursByDriver[t.driver_id] ?? 0) + 1;
        if ('driver_name' in t) nameMap[t.driver_id] = (t as TourRow).driver_name;
      }
      const shiftHours: Record<string, number> = {};
      for (const s of ss) {
        const end = s.ended_at ? new Date(s.ended_at) : new Date();
        const h = (end.getTime() - new Date(s.started_at).getTime()) / 3_600_000;
        if (h > 0 && h < 24) shiftHours[s.driver_id] = (shiftHours[s.driver_id] ?? 0) + h;
      }
      const result: Record<string, { name: string; count: number; hours: number }> = {};
      for (const id of Object.keys(toursByDriver)) {
        const hours = shiftHours[id] ?? 1;
        result[id] = { name: nameMap[id] ?? id, count: toursByDriver[id], hours };
      }
      return result;
    }

    const acc30 = computeDichte(tours, shifts);
    const accYest = computeDichte(toursYestRes.data ?? [], shiftsYestRes.data ?? []);

    const rows = Object.entries(acc30).map(([id, v]) => ({
      fahrer_id: id,
      fahrer_name: v.name,
      dichte_raw: v.count / v.hours,
      yest_dichte: accYest[id] ? accYest[id].count / accYest[id].hours : null,
    }));

    if (rows.length === 0) return NextResponse.json(MOCK);

    rows.sort((a, b) => b.dichte_raw - a.dichte_raw);
    const total = rows.length;
    const teamAvg = Math.round((rows.reduce((s, r) => s + r.dichte_raw, 0) / total) * 10) / 10;

    const fahrer: FahrerRow[] = rows.map((r, i) => {
      const rang = i + 1;
      const amp = ampelColor(rang, total);
      const rank_delta = r.yest_dichte != null ? Math.round((r.dichte_raw - r.yest_dichte) * 10) / 10 : 0;
      return {
        fahrer_id: r.fahrer_id,
        fahrer_name: r.fahrer_name,
        rang,
        dichte: Math.round(r.dichte_raw * 10) / 10,
        rank_delta,
        ampel: amp,
        alert_bottom: amp === 'rot',
      };
    });

    return NextResponse.json({
      fahrer,
      team_avg: teamAvg,
      dichtester_name: fahrer[0]?.fahrer_name ?? '—',
      niedrigster_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '—',
      alert_count: fahrer.filter(f => f.alert_bottom).length,
      gesamt: total,
      ziel: 4.0,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
