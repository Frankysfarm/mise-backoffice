import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  pausenquote_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  effizienteste_name: string;
  meiste_pausen_name: string;
  alert_count: number;
  gesamt: number;
  fahrer_single?: FahrerRow & { team_avg_pct: number; gesamt: number };
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, pausenquote_pct: 3.2,  rank_delta:  0, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, pausenquote_pct: 6.8,  rank_delta:  1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, pausenquote_pct: 11.4, rank_delta: -1, ampel: 'gelb',  alert_hoch: true  },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, pausenquote_pct: 18.7, rank_delta:  0, ampel: 'rot',   alert_hoch: true  },
  ],
  team_avg_pct: 10.0,
  effizienteste_name: 'Julia F.',
  meiste_pausen_name: 'Tim B.',
  alert_count: 2,
  gesamt: 4,
};

function ampelVon(rang: number, gesamt: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rang / gesamt;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  const driverId   = req.nextUrl.searchParams.get('driver_id');
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();
    const since30  = new Date(Date.now() - 30 * 86400000).toISOString();

    // Fetch pause records for this location in the last 30 days
    const { data: pauses, error: pauseErr } = await supabase
      .from('driver_pauses')
      .select('driver_id, duration_minutes, employee_id')
      .eq('location_id', locationId)
      .gte('created_at', since30);

    // Fetch active tour time per driver as baseline
    const { data: tours, error: tourErr } = await supabase
      .from('mise_delivery_tours')
      .select('driver_id, started_at, completed_at, employee_id')
      .eq('location_id', locationId)
      .gte('started_at', since30)
      .not('completed_at', 'is', null);

    if ((pauseErr && tourErr) || !tours || tours.length === 0) {
      return NextResponse.json(MOCK_DATA);
    }

    // Compute total active minutes per driver
    const activeMap = new Map<string, number>();
    for (const t of tours) {
      const dId = (t.driver_id ?? t.employee_id) as string | null;
      if (!dId) continue;
      const mins = (new Date(t.completed_at as string).getTime() - new Date(t.started_at as string).getTime()) / 60000;
      if (mins <= 0) continue;
      activeMap.set(dId, (activeMap.get(dId) ?? 0) + mins);
    }

    // Compute total pause minutes per driver
    const pauseMap = new Map<string, number>();
    for (const p of (pauses ?? [])) {
      const dId = (p.driver_id ?? p.employee_id) as string | null;
      if (!dId) continue;
      pauseMap.set(dId, (pauseMap.get(dId) ?? 0) + (p.duration_minutes as number ?? 0));
    }

    const driverIds = Array.from(activeMap.keys());
    if (driverIds.length === 0) return NextResponse.json(MOCK_DATA);

    // Fetch names
    const { data: profiles } = await supabase
      .from('employees')
      .select('id, name')
      .in('id', driverIds);

    const nameOf = (id: string) => profiles?.find(p => p.id === id)?.name ?? id;

    // Build rows sorted AUFSTEIGEND (lowest pausenquote = Rang 1)
    const rows = driverIds.map(id => {
      const active = activeMap.get(id) ?? 1;
      const pause  = pauseMap.get(id) ?? 0;
      const pct    = Math.round((pause / active) * 1000) / 10;
      return { id, name: nameOf(id), pct };
    });

    rows.sort((a, b) => a.pct - b.pct);

    const gesamt   = rows.length;
    const teamSum  = rows.reduce((s, r) => s + r.pct, 0);
    const team_avg_pct = Math.round(teamSum / gesamt * 10) / 10;

    const prev30Start = new Date(Date.now() - 60 * 86400000).toISOString();
    const { data: prevPauses } = await supabase
      .from('driver_pauses')
      .select('driver_id, duration_minutes, employee_id')
      .eq('location_id', locationId)
      .gte('created_at', prev30Start)
      .lt('created_at', since30);

    const { data: prevTours } = await supabase
      .from('mise_delivery_tours')
      .select('driver_id, started_at, completed_at, employee_id')
      .eq('location_id', locationId)
      .gte('started_at', prev30Start)
      .lt('started_at', since30)
      .not('completed_at', 'is', null);

    const prevActiveMap = new Map<string, number>();
    for (const t of (prevTours ?? [])) {
      const dId = (t.driver_id ?? t.employee_id) as string | null;
      if (!dId) continue;
      const mins = (new Date(t.completed_at as string).getTime() - new Date(t.started_at as string).getTime()) / 60000;
      if (mins <= 0) continue;
      prevActiveMap.set(dId, (prevActiveMap.get(dId) ?? 0) + mins);
    }
    const prevPauseMap = new Map<string, number>();
    for (const p of (prevPauses ?? [])) {
      const dId = (p.driver_id ?? p.employee_id) as string | null;
      if (!dId) continue;
      prevPauseMap.set(dId, (prevPauseMap.get(dId) ?? 0) + (p.duration_minutes as number ?? 0));
    }

    const prevRankMap = new Map<string, number>();
    const prevRows = driverIds.map(id => {
      const active = prevActiveMap.get(id) ?? 1;
      const pause  = prevPauseMap.get(id) ?? 0;
      return { id, pct: Math.round((pause / active) * 1000) / 10 };
    });
    prevRows.sort((a, b) => a.pct - b.pct);
    prevRows.forEach((r, i) => prevRankMap.set(r.id, i + 1));

    const fahrer: FahrerRow[] = rows.map((r, i) => {
      const rang  = i + 1;
      const prev  = prevRankMap.get(r.id);
      const delta = prev != null ? prev - rang : 0;
      return {
        fahrer_id:      r.id,
        fahrer_name:    r.name,
        rang,
        pausenquote_pct: r.pct,
        rank_delta:     delta,
        ampel:          ampelVon(rang, gesamt),
        alert_hoch:     r.pct > 10,
      };
    });

    const alert_count        = fahrer.filter(f => f.alert_hoch).length;
    const effizienteste_name = fahrer[0]?.fahrer_name ?? '';
    const meiste_pausen_name = fahrer[gesamt - 1]?.fahrer_name ?? '';

    const response: ApiResponse = {
      fahrer,
      team_avg_pct,
      effizienteste_name,
      meiste_pausen_name,
      alert_count,
      gesamt,
    };

    if (driverId) {
      const me = fahrer.find(f => f.fahrer_id === driverId);
      if (me) {
        response.fahrer_single = { ...me, team_avg_pct, gesamt };
      }
    }

    return NextResponse.json(response satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
