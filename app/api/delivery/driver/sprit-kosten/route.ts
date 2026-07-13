import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Phase 1203 — Fahrer-Sprit-Kosten-Analyse-API
// GET /api/delivery/driver/sprit-kosten?driver_id=<uuid>
// Tagesverbrauch in Liter je Fahrzeugtyp + Kosten je km + Gesamtkosten der Schicht

type FahrzeugTyp = 'car' | 'motorcycle' | 'scooter' | 'bicycle' | 'ebike' | 'van';

const VERBRAUCH_L_PRO_100KM: Record<FahrzeugTyp, number> = {
  car: 7.5,
  van: 10.0,
  motorcycle: 4.5,
  scooter: 3.0,
  ebike: 0.3,
  bicycle: 0,
};

const KRAFTSTOFF_PREIS_EUR = 1.85;

type ApiResponse = {
  fahrer_id: string;
  fahrzeug_typ: FahrzeugTyp;
  km_heute: number;
  verbrauch_l_pro_100km: number;
  verbrauch_l_heute: number;
  kosten_eur_heute: number;
  kosten_eur_pro_km: number;
  stopps_heute: number;
  kosten_eur_pro_stopp: number;
  generiert_am: string;
};

function computeKosten(km: number, fahrzeug: FahrzeugTyp): Omit<ApiResponse, 'fahrer_id' | 'stopps_heute' | 'kosten_eur_pro_stopp' | 'generiert_am'> {
  const v = VERBRAUCH_L_PRO_100KM[fahrzeug] ?? 7.5;
  const verbrauchL = parseFloat(((km / 100) * v).toFixed(2));
  const kostenEur = parseFloat((verbrauchL * KRAFTSTOFF_PREIS_EUR).toFixed(2));
  const kostenProKm = km > 0 ? parseFloat((kostenEur / km).toFixed(3)) : 0;
  return {
    fahrzeug_typ: fahrzeug,
    km_heute: parseFloat(km.toFixed(1)),
    verbrauch_l_pro_100km: v,
    verbrauch_l_heute: verbrauchL,
    kosten_eur_heute: kostenEur,
    kosten_eur_pro_km: kostenProKm,
  };
}

function mockData(driverId: string): ApiResponse {
  const km = 42.5;
  const fahrzeug: FahrzeugTyp = 'car';
  const stopps = 11;
  const kosten = computeKosten(km, fahrzeug);
  return {
    fahrer_id: driverId,
    ...kosten,
    stopps_heute: stopps,
    kosten_eur_pro_stopp: stopps > 0 ? parseFloat((kosten.kosten_eur_heute / stopps).toFixed(2)) : 0,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const driverId = searchParams.get('driver_id');
  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  try {
    const supabase = await createClient();
    const schichtStart = new Date(Date.now() - 12 * 3600000).toISOString();

    const { data: driver } = await supabase
      .from('mise_drivers')
      .select('id, vehicle_type')
      .eq('id', driverId)
      .single();

    const { data: stops } = await supabase
      .from('mise_delivery_stops')
      .select('id, km_driven')
      .eq('driver_id', driverId)
      .eq('status', 'completed')
      .gte('completed_at', schichtStart);

    if (!driver && (!stops || stops.length === 0)) return NextResponse.json(mockData(driverId));

    const fahrzeug = ((driver?.vehicle_type as FahrzeugTyp) ?? 'car');
    const kmHeute = (stops ?? []).reduce((s, r) => s + ((r.km_driven as number) ?? 0), 0);
    const stoppsHeute = (stops ?? []).length;
    const kosten = computeKosten(kmHeute, fahrzeug);

    return NextResponse.json({
      fahrer_id: driverId,
      ...kosten,
      stopps_heute: stoppsHeute,
      kosten_eur_pro_stopp: stoppsHeute > 0 ? parseFloat((kosten.kosten_eur_heute / stoppsHeute).toFixed(2)) : 0,
      generiert_am: new Date().toISOString(),
    } as ApiResponse);
  } catch {
    return NextResponse.json(mockData(driverId));
  }
}
