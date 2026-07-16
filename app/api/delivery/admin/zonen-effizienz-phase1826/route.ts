import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Phase 1826 — Lieferzonen-Effizienz-API
 *
 * GET /api/delivery/admin/zonen-effizienz-phase1826?location_id=<uuid>
 * Umsatz/km + Touren/Zone + Ausreißer-Alert je Zone; Multi-Tenant; Supabase+Mock.
 */

interface ZoneEffizienz {
  zone: string;
  touren: number;
  umsatz_cents: number;
  km_gesamt: number;
  umsatz_pro_km: number;
  touren_pro_fahrer: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  ausreisser: boolean;
}

interface Response {
  location_id: string;
  zonen: ZoneEffizienz[];
  team_umsatz_pro_km: number;
  ausreisser_anzahl: number;
  generiert_am: string;
}

const MOCK_RESPONSE: Omit<Response, 'location_id' | 'generiert_am'> = {
  zonen: [
    { zone: 'Mitte', touren: 42, umsatz_cents: 189000, km_gesamt: 126, umsatz_pro_km: 15.0, touren_pro_fahrer: 8.4, ampel: 'gruen', ausreisser: false },
    { zone: 'Nord', touren: 28, umsatz_cents: 112000, km_gesamt: 98, umsatz_pro_km: 11.4, touren_pro_fahrer: 5.6, ampel: 'gelb', ausreisser: false },
    { zone: 'Süd', touren: 19, umsatz_cents: 68400, km_gesamt: 95, umsatz_pro_km: 7.2, touren_pro_fahrer: 3.8, ampel: 'rot', ausreisser: true },
    { zone: 'Ost', touren: 33, umsatz_cents: 148500, km_gesamt: 99, umsatz_pro_km: 15.0, touren_pro_fahrer: 6.6, ampel: 'gruen', ausreisser: false },
    { zone: 'West', touren: 11, umsatz_cents: 33000, km_gesamt: 66, umsatz_pro_km: 5.0, touren_pro_fahrer: 2.2, ampel: 'rot', ausreisser: true },
  ],
  team_umsatz_pro_km: 10.7,
  ausreisser_anzahl: 2,
};

function ampelVon(umsatzProKm: number, team: number): 'gruen' | 'gelb' | 'rot' {
  if (umsatzProKm >= team * 1.2) return 'gruen';
  if (umsatzProKm >= team * 0.8) return 'gelb';
  return 'rot';
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const { data: batches } = await supabase
      .from('batches')
      .select('id, zone, started_at, total_km, total_revenue_cents, fahrer_id')
      .eq('location_id', locationId)
      .gte('started_at', todayStart)
      .not('zone', 'is', null);

    if (!batches || batches.length === 0) throw new Error('no_data');

    const zonesMap = new Map<string, { touren: number; umsatz: number; km: number; fahrer: Set<string> }>();

    for (const b of batches) {
      const z = b.zone ?? 'Unbekannt';
      if (!zonesMap.has(z)) zonesMap.set(z, { touren: 0, umsatz: 0, km: 0, fahrer: new Set() });
      const entry = zonesMap.get(z)!;
      entry.touren += 1;
      entry.umsatz += b.total_revenue_cents ?? 0;
      entry.km += b.total_km ?? 0;
      if (b.fahrer_id) entry.fahrer.add(b.fahrer_id);
    }

    const teamKmGes = [...zonesMap.values()].reduce((a, z) => a + z.km, 0);
    const teamUmsatz = [...zonesMap.values()].reduce((a, z) => a + z.umsatz, 0);
    const teamUmsatzProKm = teamKmGes > 0 ? teamUmsatz / teamKmGes / 100 : 10;

    const zonen: ZoneEffizienz[] = [...zonesMap.entries()].map(([zone, d]) => {
      const umsatzProKm = d.km > 0 ? (d.umsatz / d.km) / 100 : 0;
      const ampel = ampelVon(umsatzProKm, teamUmsatzProKm);
      return {
        zone,
        touren: d.touren,
        umsatz_cents: d.umsatz,
        km_gesamt: Math.round(d.km),
        umsatz_pro_km: Math.round(umsatzProKm * 10) / 10,
        touren_pro_fahrer: d.fahrer.size > 0 ? Math.round((d.touren / d.fahrer.size) * 10) / 10 : d.touren,
        ampel,
        ausreisser: ampel === 'rot',
      };
    }).sort((a, b) => b.umsatz_pro_km - a.umsatz_pro_km);

    const response: Response = {
      location_id: locationId,
      zonen,
      team_umsatz_pro_km: Math.round(teamUmsatzProKm * 10) / 10,
      ausreisser_anzahl: zonen.filter((z) => z.ausreisser).length,
      generiert_am: now.toISOString(),
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({
      ...MOCK_RESPONSE,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    } satisfies Response);
  }
}
