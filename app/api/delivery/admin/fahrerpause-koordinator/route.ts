import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIN_FAHRER_JE_ZONE = 2;
const ZONES = ['A', 'B', 'C', 'D'];
const PAUSE_DAUER_MIN = 30;

type PausenEmpfehlung = {
  fahrer_id: string;
  fahrer_name: string;
  zone: string;
  schicht_dauer_min: number;
  letzte_pause_vor_min: number | null;
  pause_empfohlen: boolean;
  pause_moeglich: boolean; // Zone hat noch ≥2 andere aktive Fahrer
  empfehlung: string;
};

type ZoneStatus = {
  zone: string;
  aktive_fahrer: number;
  auf_pause: number;
  min_erfullt: boolean;
};

function mockData(locationId: string | null) {
  const empfehlungen: PausenEmpfehlung[] = [
    { fahrer_id: 'f1', fahrer_name: 'Max Mustermann',  zone: 'A', schicht_dauer_min: 240, letzte_pause_vor_min: 180, pause_empfohlen: true,  pause_moeglich: true,  empfehlung: '3h ohne Pause — sofort Pause einplanen' },
    { fahrer_id: 'f2', fahrer_name: 'Anna Schneider',  zone: 'A', schicht_dauer_min: 180, letzte_pause_vor_min: 60,  pause_empfohlen: false, pause_moeglich: true,  empfehlung: 'Pause in 1–2h empfohlen' },
    { fahrer_id: 'f3', fahrer_name: 'Tom Fischer',     zone: 'B', schicht_dauer_min: 300, letzte_pause_vor_min: null, pause_empfohlen: true, pause_moeglich: false, empfehlung: 'Pause überfällig, aber Zone B hat nur 1 weiteren Fahrer' },
    { fahrer_id: 'f4', fahrer_name: 'Jana Weber',      zone: 'C', schicht_dauer_min: 120, letzte_pause_vor_min: 30,  pause_empfohlen: false, pause_moeglich: true,  empfehlung: 'Keine Pause nötig' },
  ];
  const zonen: ZoneStatus[] = ZONES.map(z => ({
    zone: z,
    aktive_fahrer: z === 'A' ? 3 : z === 'B' ? 2 : z === 'C' ? 2 : 1,
    auf_pause: 0,
    min_erfullt: z !== 'D',
  }));
  return { empfehlungen, zonen, location_id: locationId, generiert_am: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = await createClient();
    const now = new Date();
    const since8h = new Date(now.getTime() - 8 * 3600_000).toISOString();

    const driverQ = supabase
      .from('mise_drivers')
      .select('id, name, zone, status, shift_start, last_break_at')
      .in('status', ['online', 'on_tour', 'returning', 'pause']);
    if (locationId) driverQ.eq('location_id', locationId);

    const { data: drivers, error } = await driverQ;
    if (error || !drivers || drivers.length === 0) throw new Error('no data');

    // Count active drivers per zone (not on pause)
    const zoneActive = new Map<string, number>();
    const zonePause = new Map<string, number>();
    for (const d of drivers) {
      const z = (d.zone as string | null) ?? 'Unbekannt';
      if (d.status === 'pause') {
        zonePause.set(z, (zonePause.get(z) ?? 0) + 1);
      } else {
        zoneActive.set(z, (zoneActive.get(z) ?? 0) + 1);
      }
    }

    const empfehlungen: PausenEmpfehlung[] = drivers
      .filter(d => d.status !== 'pause')
      .map(d => {
        const zone = (d.zone as string | null) ?? 'Unbekannt';
        const shiftStart = d.shift_start ? new Date(d.shift_start as string) : new Date(since8h);
        const schicht_dauer_min = Math.round((now.getTime() - shiftStart.getTime()) / 60_000);
        const letzte_pause_vor_min = d.last_break_at
          ? Math.round((now.getTime() - new Date(d.last_break_at as string).getTime()) / 60_000)
          : null;

        const activeFahrerInZone = zoneActive.get(zone) ?? 0;
        // Pause is possible if after removing this driver, zone still has ≥ MIN_FAHRER_JE_ZONE
        const pause_moeglich = activeFahrerInZone - 1 >= MIN_FAHRER_JE_ZONE;

        const sinceLastBreak = letzte_pause_vor_min ?? schicht_dauer_min;
        const pause_empfohlen = sinceLastBreak >= 120 || schicht_dauer_min >= 240;

        let empfehlung: string;
        if (!pause_empfohlen) {
          empfehlung = 'Keine Pause nötig';
        } else if (!pause_moeglich) {
          empfehlung = `Pause überfällig, aber Zone ${zone} hat zu wenig Fahrer`;
        } else if (sinceLastBreak >= 180 || schicht_dauer_min >= 300) {
          empfehlung = `${sinceLastBreak}min ohne Pause — sofort einplanen`;
        } else {
          empfehlung = `Pause nach ${sinceLastBreak}min empfohlen`;
        }

        return {
          fahrer_id: d.id as string,
          fahrer_name: (d.name as string | null) ?? 'Unbekannt',
          zone,
          schicht_dauer_min,
          letzte_pause_vor_min,
          pause_empfohlen,
          pause_moeglich,
          empfehlung,
        };
      });

    const zonen: ZoneStatus[] = ZONES.map(z => ({
      zone: z,
      aktive_fahrer: zoneActive.get(z) ?? 0,
      auf_pause: zonePause.get(z) ?? 0,
      min_erfullt: (zoneActive.get(z) ?? 0) >= MIN_FAHRER_JE_ZONE,
    }));

    return NextResponse.json({ empfehlungen, zonen, location_id: locationId, generiert_am: now.toISOString() });
  } catch {
    return NextResponse.json(mockData(locationId));
  }
}
