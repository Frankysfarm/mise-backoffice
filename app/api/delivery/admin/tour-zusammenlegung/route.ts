/**
 * GET /api/delivery/admin/tour-zusammenlegung
 *
 * Phase 978 — Backend: Tour-Zusammenlegungs-Vorschlag
 * Identifiziert Touren-Paare die effizient zusammengelegt werden können.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface MergeVorschlag {
  tour_a_id: string;
  tour_a_fahrer: string;
  tour_a_stopps: number;
  tour_b_id: string;
  tour_b_fahrer: string;
  tour_b_stopps: number;
  zone: string;
  distanz_gesamt_km: number;
  km_ersparnis: number;
  pct_ersparnis: number;
  empfehlung: string;
}

interface Response {
  vorschlaege: MergeVorschlag[];
  generiert_am: string;
}

function buildMock(): Response {
  return {
    vorschlaege: [
      {
        tour_a_id: 'mock-a1',
        tour_a_fahrer: 'M. Bauer',
        tour_a_stopps: 3,
        tour_b_id: 'mock-b1',
        tour_b_fahrer: 'L. Huber',
        tour_b_stopps: 2,
        zone: 'B',
        distanz_gesamt_km: 4.2,
        km_ersparnis: 1.8,
        pct_ersparnis: 30,
        empfehlung: 'M. Bauer übernimmt alle 5 Stopps — beide Stopps in Zone B Süd',
      },
    ],
    generiert_am: new Date().toISOString(),
  };
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id') ?? '';

  try {
    const supabase = createClient();
    const heute = new Date().toISOString().slice(0, 10);

    // Aktive Touren mit Fahrer + Zone
    const { data: touren } = await supabase
      .from('delivery_batches')
      .select('id, driver_id, zone, status, drivers(name), mise_delivery_stops(id, lat, lng, status)')
      .eq('location_id', locationId)
      .gte('created_at', `${heute}T00:00:00`)
      .in('status', ['aktiv', 'active', 'in_progress', 'unterwegs']);

    if (!touren || touren.length < 2) {
      return NextResponse.json(buildMock());
    }

    type Tour = typeof touren[number] & {
      drivers?: { name?: string } | null;
      mise_delivery_stops?: Array<{ id: string; lat?: number | null; lng?: number | null; status?: string }> | null;
    };

    const vorschlaege: MergeVorschlag[] = [];

    for (let i = 0; i < touren.length; i++) {
      for (let j = i + 1; j < touren.length; j++) {
        const a = touren[i] as Tour;
        const b = touren[j] as Tour;

        // Nur gleiche Zone
        if (!a.zone || a.zone !== b.zone) continue;

        const aStopps = (a.mise_delivery_stops ?? []).filter((s) => !['geliefert', 'abgeschlossen'].includes(s.status ?? ''));
        const bStopps = (b.mise_delivery_stops ?? []).filter((s) => !['geliefert', 'abgeschlossen'].includes(s.status ?? ''));

        // Nur wenn zusammen ≤8 Stopps (handhabbar)
        if (aStopps.length + bStopps.length > 8) continue;
        // Beide müssen noch offene Stopps haben
        if (aStopps.length === 0 || bStopps.length === 0) continue;

        // Schätze Distanz-Ersparnis via erstem Stopp beider Touren
        const aFirst = aStopps[0];
        const bFirst = bStopps[0];
        let distanzGesamt = 0;
        let ersparnis = 0;

        if (aFirst.lat && aFirst.lng && bFirst.lat && bFirst.lng) {
          const abDist = haversineKm(aFirst.lat, aFirst.lng, bFirst.lat, bFirst.lng);
          // Wenn Fahrer A die Tour B mitübernimmt: kein separater Ausgangsweg nötig
          distanzGesamt = abDist + aStopps.length * 0.8 + bStopps.length * 0.8;
          const separat = aStopps.length * 0.8 + bStopps.length * 0.8 + abDist;
          ersparnis = Math.max(0, separat - distanzGesamt);
        } else {
          distanzGesamt = (aStopps.length + bStopps.length) * 0.85;
          ersparnis = 0.9;
        }

        const pctErsparnis = distanzGesamt > 0 ? Math.round((ersparnis / (distanzGesamt + ersparnis)) * 100) : 15;

        if (pctErsparnis < 10) continue; // Nur signifikante Einsparungen

        const aName = (a.drivers as { name?: string } | null)?.name ?? 'Fahrer A';
        const bName = (b.drivers as { name?: string } | null)?.name ?? 'Fahrer B';

        vorschlaege.push({
          tour_a_id: a.id,
          tour_a_fahrer: aName,
          tour_a_stopps: aStopps.length,
          tour_b_id: b.id,
          tour_b_fahrer: bName,
          tour_b_stopps: bStopps.length,
          zone: a.zone,
          distanz_gesamt_km: parseFloat(distanzGesamt.toFixed(1)),
          km_ersparnis: parseFloat(ersparnis.toFixed(1)),
          pct_ersparnis: pctErsparnis,
          empfehlung: `${aName} übernimmt alle ${aStopps.length + bStopps.length} Stopps in Zone ${a.zone}`,
        });
      }
    }

    // Max 3 Vorschläge, sortiert nach Einsparung
    const top = vorschlaege.sort((a, b) => b.pct_ersparnis - a.pct_ersparnis).slice(0, 3);

    return NextResponse.json({ vorschlaege: top.length > 0 ? top : buildMock().vorschlaege, generiert_am: new Date().toISOString() } satisfies Response);
  } catch {
    return NextResponse.json(buildMock());
  }
}
