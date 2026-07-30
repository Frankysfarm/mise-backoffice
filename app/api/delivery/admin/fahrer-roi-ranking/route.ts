import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  roi_score: number;
  roi: number;
  einnahmen: number;
  gesamtkosten: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_score: number;
  team_avg_roi: number;
  meister_name: string;
  schwächster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, roi_score: 82, roi: 2.05, einnahmen: 148, gesamtkosten: 72,  rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, roi_score: 71, roi: 1.78, einnahmen: 124, gesamtkosten: 70,  rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, roi_score: 54, roi: 1.42, einnahmen:  98, gesamtkosten: 69,  rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, roi_score: 31, roi: 0.88, einnahmen:  72, gesamtkosten: 82,  rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_score: 60,
  team_avg_roi: 1.53,
  meister_name: 'Max M.',
  schwächster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

const LOHN_PRO_STUNDE = 12.50;
const KM_KOSTEN_PRO_KM = 0.30;

function calcRoiScore(roi: number): number {
  return Math.round(Math.min(100, Math.max(0, ((roi - 0.5) / 1.5) * 100)));
}

function ampelVon(score: number, q25: number, q75: number): 'gruen' | 'gelb' | 'rot' {
  if (score >= q75) return 'gruen';
  if (score >= q25) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);

    const { data: shifts } = await supabase
      .from('driver_shifts')
      .select('id, driver_id, started_at, ended_at, km_start, km_ende')
      .eq('location_id', locationId)
      .gte('started_at', todayStart.toISOString())
      .in('status', ['active', 'completed']);

    if (!shifts?.length) return NextResponse.json(MOCK_DATA);

    const driverIds = [...new Set(shifts.map(s => s.driver_id as string))];

    const { data: drivers } = await supabase
      .from('mise_drivers')
      .select('id, vorname, nachname')
      .in('id', driverIds);

    const driverMap = new Map(
      (drivers ?? []).map(d => [
        d.id as string,
        `${d.vorname ?? ''} ${(d.nachname as string | undefined)?.charAt(0) ?? ''}.`.trim(),
      ])
    );

    const { data: batches } = await supabase
      .from('delivery_batches')
      .select('driver_id, delivery_fee, total_stops')
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString())
      .not('delivery_fee', 'is', null);

    const einnahmenMap = new Map<string, number>();
    const stoppsMap = new Map<string, number>();
    for (const b of batches ?? []) {
      const did = b.driver_id as string;
      if (!did) continue;
      einnahmenMap.set(did, (einnahmenMap.get(did) ?? 0) + Number(b.delivery_fee ?? 0));
      stoppsMap.set(did, (stoppsMap.get(did) ?? 0) + Number(b.total_stops ?? 1));
    }

    const schichtMap = new Map<string, number>();
    const kmMap = new Map<string, number>();
    for (const shift of shifts) {
      const did = shift.driver_id as string;
      const start = new Date(shift.started_at as string);
      const end = shift.ended_at ? new Date(shift.ended_at as string) : now;
      const min = Math.max(0, (end.getTime() - start.getTime()) / 60_000);
      schichtMap.set(did, (schichtMap.get(did) ?? 0) + min);
      if (shift.km_start != null && shift.km_ende != null) {
        const km = Number(shift.km_ende) - Number(shift.km_start);
        if (km > 0) kmMap.set(did, (kmMap.get(did) ?? 0) + km);
      }
    }

    const unsorted = driverIds.map(did => {
      const einnahmen = einnahmenMap.get(did) ?? 0;
      const stopps = stoppsMap.get(did) ?? 0;
      const schichtH = (schichtMap.get(did) ?? 60) / 60;
      const km = kmMap.get(did) ?? stopps * 2.5;
      const gesamtkosten = schichtH * LOHN_PRO_STUNDE + km * KM_KOSTEN_PRO_KM;
      const roi = gesamtkosten > 0 ? einnahmen / gesamtkosten : 0;
      return {
        fahrer_id: did,
        fahrer_name: driverMap.get(did) ?? 'Fahrer',
        roi_score: calcRoiScore(roi),
        roi: Math.round(roi * 100) / 100,
        einnahmen: Math.round(einnahmen * 100) / 100,
        gesamtkosten: Math.round(gesamtkosten * 100) / 100,
      };
    });

    const sorted = [...unsorted].sort((a, b) => b.roi_score - a.roi_score);
    const total = sorted.length;
    const scores = sorted.map(f => f.roi_score);
    const q25 = scores[Math.floor(total * 0.75)] ?? 0;
    const q75 = scores[Math.floor(total * 0.25)] ?? 100;

    const prevSorted = [...unsorted].sort((a, b) => b.roi_score - a.roi_score);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      return {
        ...f,
        rang,
        rank_delta: (prevRanks.get(f.fahrer_id) ?? rang) - rang,
        ampel: ampelVon(f.roi_score, q25, q75),
        alert_niedrig: f.roi_score < 35,
      };
    });

    const team_avg_score = Math.round(fahrer.reduce((s, f) => s + f.roi_score, 0) / total);
    const team_avg_roi = Math.round((fahrer.reduce((s, f) => s + f.roi, 0) / total) * 100) / 100;

    return NextResponse.json({
      fahrer,
      team_avg_score,
      team_avg_roi,
      meister_name: fahrer[0]?.fahrer_name ?? '',
      schwächster_name: fahrer[total - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_niedrig).length,
      gesamt: total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
