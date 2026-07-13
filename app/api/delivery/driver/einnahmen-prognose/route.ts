import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface EinnahmenPrognose {
  fahrer_id: string;
  bisherige_einnahmen_eur: number;
  aktive_stunden: number;
  verbleibende_stunden: number;
  prognose_tagesende_eur: number;
  stopp_bonus_eur: number;
  einnahmen_pro_stunde_eur: number;
  stopp_anzahl_heute: number;
  ziel_bronze_eur: number;
  ziel_silber_eur: number;
  ziel_gold_eur: number;
  ziel_status: 'unter_bronze' | 'bronze' | 'silber' | 'gold';
}

function mockData(driverId: string): EinnahmenPrognose {
  const bisherige = 68.5;
  const aktiveStunden = 3.5;
  const verbleibende = 4.5;
  const stoppAnzahl = 12;
  const einnahmenProStunde = bisherige / Math.max(aktiveStunden, 0.1);
  const stoppBonus = stoppAnzahl * 0.25;
  const prognose = einnahmenProStunde * verbleibende + bisherige + stoppBonus;
  return {
    fahrer_id: driverId,
    bisherige_einnahmen_eur: bisherige,
    aktive_stunden: aktiveStunden,
    verbleibende_stunden: verbleibende,
    prognose_tagesende_eur: Math.round(prognose * 100) / 100,
    stopp_bonus_eur: stoppBonus,
    einnahmen_pro_stunde_eur: Math.round(einnahmenProStunde * 100) / 100,
    stopp_anzahl_heute: stoppAnzahl,
    ziel_bronze_eur: 80,
    ziel_silber_eur: 120,
    ziel_gold_eur: 160,
    ziel_status: prognose >= 160 ? 'gold' : prognose >= 120 ? 'silber' : prognose >= 80 ? 'bronze' : 'unter_bronze',
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const driverId = searchParams.get('driver_id');

  if (!driverId) {
    return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: driver } = await supabase
      .from('mise_drivers')
      .select('id, shift_started_at, shift_ends_at, location_id')
      .eq('id', driverId)
      .single();

    if (!driver) return NextResponse.json(mockData(driverId));

    const shiftStart = driver.shift_started_at ? new Date(driver.shift_started_at) : todayStart;
    const shiftEnd = driver.shift_ends_at ? new Date(driver.shift_ends_at) : new Date(shiftStart.getTime() + 8 * 3600 * 1000);
    const now = new Date();

    const aktiveStunden = Math.max((now.getTime() - shiftStart.getTime()) / 3600000, 0.1);
    const verbleibendeStunden = Math.max((shiftEnd.getTime() - now.getTime()) / 3600000, 0);

    const { data: stops } = await supabase
      .from('mise_delivery_stops')
      .select('id, tip_eur, delivery_fee_eur, completed_at')
      .eq('driver_id', driverId)
      .gte('completed_at', todayStart.toISOString())
      .eq('status', 'delivered');

    const stoppAnzahl = stops?.length ?? 0;
    const bisherige = (stops ?? []).reduce(
      (sum, s) => sum + (s.tip_eur ?? 0) + (s.delivery_fee_eur ?? 0),
      0,
    );

    const stoppBonus = stoppAnzahl * 0.25;
    const einnahmenProStunde = bisherige / Math.max(aktiveStunden, 0.1);
    const prognose = bisherige + einnahmenProStunde * verbleibendeStunden + stoppBonus;

    const result: EinnahmenPrognose = {
      fahrer_id: driverId,
      bisherige_einnahmen_eur: Math.round(bisherige * 100) / 100,
      aktive_stunden: Math.round(aktiveStunden * 10) / 10,
      verbleibende_stunden: Math.round(verbleibendeStunden * 10) / 10,
      prognose_tagesende_eur: Math.round(prognose * 100) / 100,
      stopp_bonus_eur: Math.round(stoppBonus * 100) / 100,
      einnahmen_pro_stunde_eur: Math.round(einnahmenProStunde * 100) / 100,
      stopp_anzahl_heute: stoppAnzahl,
      ziel_bronze_eur: 80,
      ziel_silber_eur: 120,
      ziel_gold_eur: 160,
      ziel_status:
        prognose >= 160 ? 'gold' : prognose >= 120 ? 'silber' : prognose >= 80 ? 'bronze' : 'unter_bronze',
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(mockData(driverId));
  }
}
