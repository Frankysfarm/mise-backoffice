import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerBonusInfo {
  driver_id: string;
  name: string;
  touren_abgeschlossen: number;
  bonus_punkte: number;
  streak_count: number;
  multiplikator: number;
  alert_null_touren: boolean;
}

export interface TourAbschlussBonusResponse {
  location_id: string;
  fahrer: FahrerBonusInfo[];
  team_gesamt_bonus: number;
  top_fahrer: string | null;
  alert_null_touren_count: number;
  generiert_am: string;
}

const MOCK: TourAbschlussBonusResponse = {
  location_id: 'mock',
  fahrer: [
    { driver_id: 'd1', name: 'Max M.',   touren_abgeschlossen: 5, bonus_punkte: 150, streak_count: 5, multiplikator: 2.0, alert_null_touren: false },
    { driver_id: 'd2', name: 'Sarah K.', touren_abgeschlossen: 3, bonus_punkte:  90, streak_count: 3, multiplikator: 1.5, alert_null_touren: false },
    { driver_id: 'd3', name: 'Tom B.',   touren_abgeschlossen: 1, bonus_punkte:  20, streak_count: 1, multiplikator: 1.0, alert_null_touren: false },
    { driver_id: 'd4', name: 'Anna L.',  touren_abgeschlossen: 0, bonus_punkte:   0, streak_count: 0, multiplikator: 1.0, alert_null_touren: true  },
  ],
  team_gesamt_bonus: 260,
  top_fahrer: 'Max M.',
  alert_null_touren_count: 1,
  generiert_am: new Date().toISOString(),
};

function calcMultiplikator(streak: number): number {
  if (streak >= 5) return 2.0;
  if (streak >= 3) return 1.5;
  return 1.0;
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id')?.trim();
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: drivers } = await sb
      .from('drivers')
      .select('id, vorname, nachname')
      .eq('location_id', locationId);

    const { data: batches } = await sb
      .from('delivery_batches')
      .select('id, driver_id, status, created_at')
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString());

    if (!drivers || !batches) return NextResponse.json({ ...MOCK, location_id: locationId });

    const fahrerList: FahrerBonusInfo[] = [];
    let teamGesamt = 0;

    for (const d of drivers) {
      const own = batches.filter(b => b.driver_id === d.id);
      const abgeschlossen = own.filter(b => b.status === 'abgeschlossen' || b.status === 'delivered').length;
      const streak = abgeschlossen;
      const multi = calcMultiplikator(streak);
      const basePunkte = abgeschlossen * 20;
      const bonus = Math.round(basePunkte * multi);

      fahrerList.push({
        driver_id: d.id,
        name: `${d.vorname} ${d.nachname.charAt(0)}.`,
        touren_abgeschlossen: abgeschlossen,
        bonus_punkte: bonus,
        streak_count: streak,
        multiplikator: multi,
        alert_null_touren: abgeschlossen === 0 && own.length > 0,
      });

      teamGesamt += bonus;
    }

    if (fahrerList.length === 0) return NextResponse.json({ ...MOCK, location_id: locationId });

    fahrerList.sort((a, b) => b.bonus_punkte - a.bonus_punkte);
    const nullAlerts = fahrerList.filter(f => f.alert_null_touren).length;
    const topFahrer = fahrerList.find(f => f.bonus_punkte > 0)?.name ?? null;

    return NextResponse.json({
      location_id: locationId,
      fahrer: fahrerList,
      team_gesamt_bonus: teamGesamt,
      top_fahrer: topFahrer,
      alert_null_touren_count: nullAlerts,
      generiert_am: new Date().toISOString(),
    } satisfies TourAbschlussBonusResponse);
  } catch {
    return NextResponse.json({ ...MOCK, location_id: locationId });
  }
}
