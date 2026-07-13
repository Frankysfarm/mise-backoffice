import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface FahrerPause {
  fahrer_id: string;
  fahrer_name: string;
  letzte_pause_vor_min: number | null;
  aktive_touren_in_zone: number;
  empfehlung: 'pausieren' | 'bald' | 'weiter';
  empfehlung_grund: string;
}

interface PauseResponse {
  fahrer: FahrerPause[];
  gesamt_aktive_touren: number;
  ruhige_fahrer_anzahl: number;
  location_id: string;
  generiert_am: string;
}

function mockResponse(locationId: string): PauseResponse {
  const fahrer: FahrerPause[] = [
    {
      fahrer_id: 'mock-1', fahrer_name: 'Lars M.',
      letzte_pause_vor_min: 180, aktive_touren_in_zone: 1,
      empfehlung: 'pausieren', empfehlung_grund: 'Keine Pause seit 3h, Zone ruhig',
    },
    {
      fahrer_id: 'mock-2', fahrer_name: 'Ying K.',
      letzte_pause_vor_min: 45, aktive_touren_in_zone: 4,
      empfehlung: 'weiter', empfehlung_grund: 'Ausreichend ausgeruht, Zone aktiv',
    },
    {
      fahrer_id: 'mock-3', fahrer_name: 'Pavel N.',
      letzte_pause_vor_min: 120, aktive_touren_in_zone: 2,
      empfehlung: 'bald', empfehlung_grund: 'Pause in ~30 Min empfohlen',
    },
  ];
  return {
    fahrer,
    gesamt_aktive_touren: fahrer.reduce((s, f) => s + f.aktive_touren_in_zone, 0),
    ruhige_fahrer_anzahl: fahrer.filter((f) => f.empfehlung === 'pausieren').length,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

function empfehlung(
  letzteVorMin: number | null,
  aktiveTourenInZone: number,
): { emp: FahrerPause['empfehlung']; grund: string } {
  const ruhig = aktiveTourenInZone <= 2;
  if (ruhig && (letzteVorMin === null || letzteVorMin >= 150)) {
    return { emp: 'pausieren', grund: `Zone ruhig (${aktiveTourenInZone} Touren), Pause überfällig` };
  }
  if (ruhig && letzteVorMin !== null && letzteVorMin >= 90) {
    return { emp: 'bald', grund: 'Pause in ~30 Min empfohlen, Zone wird ruhiger' };
  }
  return { emp: 'weiter', grund: aktiveTourenInZone > 2 ? 'Zone aktiv, weiter fahren' : 'Ausreichend ausgeruht' };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const { data: drivers } = await supabase
      .from('mise_drivers')
      .select('id, first_name, last_name, last_break_at, current_zone')
      .eq('location_id', locationId)
      .eq('ist_online', true);

    if (!drivers || drivers.length === 0) return NextResponse.json(mockResponse(locationId));

    const { data: activeBatches } = await supabase
      .from('mise_delivery_batches')
      .select('id, zone, driver_id')
      .eq('location_id', locationId)
      .eq('status', 'active');

    const now = Date.now();

    const fahrer: FahrerPause[] = drivers.map((d) => {
      const letzteVorMin = d.last_break_at
        ? Math.round((now - new Date(d.last_break_at).getTime()) / 60000)
        : null;
      const zone = d.current_zone ?? null;
      const aktiveTourenInZone = zone
        ? (activeBatches ?? []).filter((b) => b.zone === zone).length
        : (activeBatches ?? []).filter((b) => b.driver_id === d.id).length;

      const { emp, grund } = empfehlung(letzteVorMin, aktiveTourenInZone);
      return {
        fahrer_id: d.id,
        fahrer_name: `${d.first_name ?? ''} ${(d.last_name ?? '').charAt(0)}.`.trim(),
        letzte_pause_vor_min: letzteVorMin,
        aktive_touren_in_zone: aktiveTourenInZone,
        empfehlung: emp,
        empfehlung_grund: grund,
      };
    });

    return NextResponse.json({
      fahrer,
      gesamt_aktive_touren: (activeBatches ?? []).length,
      ruhige_fahrer_anzahl: fahrer.filter((f) => f.empfehlung === 'pausieren').length,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    } satisfies PauseResponse);
  } catch {
    return NextResponse.json(mockResponse(locationId));
  }
}
