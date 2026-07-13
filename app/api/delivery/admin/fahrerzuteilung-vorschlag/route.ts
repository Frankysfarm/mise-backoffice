import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FahrerVorschlag = {
  fahrer_id: string;
  fahrer_name: string;
  zone: string;
  score: number;
  bewertung: number;
  aktive_touren: number;
  match_level: 'optimal' | 'gut' | 'akzeptabel';
  grund: string;
};

type Response = {
  vorschlaege: FahrerVorschlag[];
  offene_bestellungen: number;
  naechste_zone: string | null;
  location_id: string | null;
  generiert_am: string;
};

function mockData(locationId: string | null): Response {
  return {
    vorschlaege: [
      { fahrer_id: 'f1', fahrer_name: 'Max M.',  zone: 'A', score: 91, bewertung: 4.8, aktive_touren: 0, match_level: 'optimal',    grund: 'Verfügbar · Zone A-Spezialist · Ø 4.8★' },
      { fahrer_id: 'f2', fahrer_name: 'Lisa B.',  zone: 'A', score: 82, bewertung: 4.5, aktive_touren: 0, match_level: 'gut',        grund: 'Verfügbar · gute Zone-Kenntnis · Ø 4.5★' },
      { fahrer_id: 'f3', fahrer_name: 'Tom K.',   zone: 'B', score: 68, bewertung: 4.2, aktive_touren: 1, match_level: 'akzeptabel', grund: '1 aktive Tour · benachbarte Zone B' },
    ],
    offene_bestellungen: 3,
    naechste_zone: 'A',
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = await createClient();

    const driversQ = supabase
      .from('mise_drivers')
      .select('id, full_name, location_id, current_zone, rating_avg')
      .in('status', ['online', 'returning']);
    if (locationId) driversQ.eq('location_id', locationId);
    const { data: drivers, error: dErr } = await driversQ;
    if (dErr || !drivers || drivers.length === 0) throw new Error('no drivers');

    const ordersQ = supabase
      .from('customer_orders')
      .select('id, delivery_zone')
      .in('status', ['confirmed', 'angenommen', 'ready'])
      .order('created_at', { ascending: true })
      .limit(10);
    if (locationId) ordersQ.eq('location_id', locationId);
    const { data: orders } = await ordersQ;

    const naechste_zone = (orders ?? [])[0]?.delivery_zone ?? null;

    const batchQ = supabase
      .from('mise_delivery_batches')
      .select('driver_id')
      .in('status', ['unterwegs', 'active', 'picking_up']);
    const { data: activeBatches } = await batchQ;
    const activeToursByDriver = new Map<string, number>();
    for (const b of activeBatches ?? []) {
      activeToursByDriver.set(b.driver_id, (activeToursByDriver.get(b.driver_id) ?? 0) + 1);
    }

    const vorschlaege: FahrerVorschlag[] = drivers.map(d => {
      const zone = (d.current_zone as string | null) ?? 'Unbekannt';
      const bewertung = (d.rating_avg as number | null) ?? 4.0;
      const aktive_touren = activeToursByDriver.get(d.id) ?? 0;
      const zoneMatch = naechste_zone ? (zone === naechste_zone ? 30 : 10) : 15;
      const auslastungsPenalty = aktive_touren * 20;
      const bewertungsBonus = (bewertung - 3) * 10;
      const score = Math.max(0, Math.min(100, 50 + zoneMatch + bewertungsBonus - auslastungsPenalty));
      const match_level: FahrerVorschlag['match_level'] = score >= 80 ? 'optimal' : score >= 60 ? 'gut' : 'akzeptabel';
      const grund = aktive_touren === 0
        ? `Verfügbar · Zone ${zone}${naechste_zone === zone ? ' (Treffer)' : ''} · Ø ${bewertung.toFixed(1)}★`
        : `${aktive_touren} aktive Tour${aktive_touren > 1 ? 'en' : ''} · Zone ${zone} · Ø ${bewertung.toFixed(1)}★`;

      return { fahrer_id: d.id, fahrer_name: d.full_name ?? `Fahrer`, zone, score, bewertung, aktive_touren, match_level, grund };
    }).sort((a, b) => b.score - a.score).slice(0, 5);

    return NextResponse.json({
      vorschlaege,
      offene_bestellungen: (orders ?? []).length,
      naechste_zone,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(mockData(locationId));
  }
}
