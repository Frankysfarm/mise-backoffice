import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  index: number;
  contact_attempts: number;
  contact_success: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_index: number;
  beste_name: string;
  niedrigste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, index: 96, contact_attempts: 25, contact_success: 24, rank_delta: 0,  ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, index: 83, contact_attempts: 18, contact_success: 15, rank_delta: 1,  ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, index: 72, contact_attempts: 22, contact_success: 16, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, index: 51, contact_attempts: 20, contact_success: 10, rank_delta: 0,  ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_index: 76,
  beste_name: 'Julia F.',
  niedrigste_name: 'Tim B.',
  alert_count: 1,
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

    const cur30Start  = new Date(Date.now() - 30 * 86400000).toISOString();
    const prev30Start = new Date(Date.now() - 60 * 86400000).toISOString();

    const [commsRes, prevCommsRes] = await Promise.all([
      supabase
        .from('driver_comms_log')
        .select('driver_id, contact_attempted, contact_reached, created_at')
        .eq('location_id', locationId)
        .gte('created_at', cur30Start),
      supabase
        .from('driver_comms_log')
        .select('driver_id, contact_attempted, contact_reached')
        .eq('location_id', locationId)
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start),
    ]);

    const comms = commsRes.data ?? [];
    if (!comms.length) return NextResponse.json(MOCK_DATA);

    type Acc = { attempts: number; success: number };
    const groupCur = new Map<string, Acc>();
    for (const c of comms) {
      const id = c.driver_id as string;
      if (!id) continue;
      const prev = groupCur.get(id) ?? { attempts: 0, success: 0 };
      groupCur.set(id, {
        attempts: prev.attempts + (c.contact_attempted ? 1 : 0),
        success:  prev.success  + (c.contact_reached  ? 1 : 0),
      });
    }

    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, Acc>();
    for (const c of prevCommsRes.data ?? []) {
      const id = c.driver_id as string;
      if (!id) continue;
      const prev = groupPrev.get(id) ?? { attempts: 0, success: 0 };
      groupPrev.set(id, {
        attempts: prev.attempts + (c.contact_attempted ? 1 : 0),
        success:  prev.success  + (c.contact_reached  ? 1 : 0),
      });
    }

    const calcIndex = (acc: Acc) =>
      acc.attempts > 0 ? Math.round((acc.success / acc.attempts) * 100) : 0;

    const unsorted = Array.from(groupCur.entries()).map(([id, acc]) => ({
      fahrer_id:        id,
      fahrer_name:      id.slice(0, 8),
      index:            calcIndex(acc),
      contact_attempts: acc.attempts,
      contact_success:  acc.success,
    }));

    const sorted = [...unsorted].sort((a, b) => b.index - a.index);
    const gesamt = sorted.length;

    const prevUnsorted = Array.from(groupCur.entries()).map(([id]) => {
      const p = groupPrev.get(id);
      return { fahrer_id: id, index: p ? calcIndex(p) : calcIndex(groupCur.get(id)!) };
    });
    const prevSorted = [...prevUnsorted].sort((a, b) => b.index - a.index);
    const prevRanks  = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const teamAvgIndex = Math.round(sorted.reduce((s, f) => s + f.index, 0) / gesamt);

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      return {
        fahrer_id:        f.fahrer_id,
        fahrer_name:      f.fahrer_name,
        rang,
        index:            f.index,
        contact_attempts: f.contact_attempts,
        contact_success:  f.contact_success,
        rank_delta:       prevRang - rang,
        ampel:            ampelVon(rang, gesamt),
        alert_niedrig:    f.index < 60,
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    return NextResponse.json({
      fahrer,
      team_avg_index:  teamAvgIndex,
      beste_name:      sorted[0]?.fahrer_name ?? '',
      niedrigste_name: sorted[gesamt - 1]?.fahrer_name ?? '',
      alert_count:     fahrer.filter(f => f.alert_niedrig).length,
      gesamt,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
