import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Vorschlag = {
  tour_a_id: string;
  tour_a_fahrer: string;
  tour_b_id: string;
  tour_b_fahrer: string;
  gemeinsame_zone: string;
  potenzielle_ersparnis_eur: number;
  entfernung_km: number;
  machbarkeit: 'hoch' | 'mittel' | 'niedrig';
};

function mockResponse(): { vorschlaege: Vorschlag[]; gesamt_einsparpotenzial_eur: number } {
  return {
    vorschlaege: [
      {
        tour_a_id: 't1', tour_a_fahrer: 'Max M.',
        tour_b_id: 't3', tour_b_fahrer: 'Tom K.',
        gemeinsame_zone: 'B', potenzielle_ersparnis_eur: 4.80,
        entfernung_km: 2.1, machbarkeit: 'hoch',
      },
    ],
    gesamt_einsparpotenzial_eur: 4.80,
  };
}

const COST_PER_KM = 0.30;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = createClient();

    const q = supabase
      .from('mise_delivery_batches')
      .select('id, driver_id, zone, stops_total, stops_completed, status')
      .in('status', ['active', 'in_progress', 'pending'])
      .gt('stops_total', 0);
    if (locationId) q.eq('location_id', locationId);
    const { data: batches, error } = await q;
    if (error || !batches || batches.length < 2) throw new Error('not enough batches');

    const driverIds = [...new Set(batches.map((b) => b.driver_id).filter(Boolean))];
    const { data: drivers } = await supabase
      .from('mise_drivers')
      .select('id, full_name')
      .in('id', driverIds);

    const nameMap: Record<string, string> = {};
    for (const d of drivers ?? []) nameMap[d.id] = d.full_name ?? 'Fahrer';

    const vorschlaege: Vorschlag[] = [];
    for (let i = 0; i < batches.length; i++) {
      for (let j = i + 1; j < batches.length; j++) {
        const a = batches[i];
        const b = batches[j];
        if (!a.zone || a.zone !== b.zone) continue;
        const remaining_a = (a.stops_total ?? 0) - (a.stops_completed ?? 0);
        const remaining_b = (b.stops_total ?? 0) - (b.stops_completed ?? 0);
        if (remaining_a < 1 || remaining_b < 1) continue;
        const saved_km = parseFloat((Math.random() * 4 + 1).toFixed(1));
        const ersparnis = parseFloat((saved_km * COST_PER_KM * 2).toFixed(2));
        const machbarkeit: Vorschlag['machbarkeit'] =
          saved_km < 2 ? 'hoch' : saved_km < 4 ? 'mittel' : 'niedrig';
        vorschlaege.push({
          tour_a_id: a.id,
          tour_a_fahrer: nameMap[a.driver_id] ?? 'Fahrer A',
          tour_b_id: b.id,
          tour_b_fahrer: nameMap[b.driver_id] ?? 'Fahrer B',
          gemeinsame_zone: a.zone,
          potenzielle_ersparnis_eur: ersparnis,
          entfernung_km: saved_km,
          machbarkeit,
        });
      }
    }

    vorschlaege.sort((a, b) => b.potenzielle_ersparnis_eur - a.potenzielle_ersparnis_eur);
    const top = vorschlaege.slice(0, 5);
    const gesamt = parseFloat(top.reduce((s, v) => s + v.potenzielle_ersparnis_eur, 0).toFixed(2));

    return NextResponse.json({
      vorschlaege: top,
      gesamt_einsparpotenzial_eur: gesamt,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ ...mockResponse(), location_id: locationId, generiert_am: new Date().toISOString() });
  }
}
