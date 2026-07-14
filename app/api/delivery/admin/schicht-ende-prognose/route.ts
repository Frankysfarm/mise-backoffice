/**
 * GET /api/delivery/admin/schicht-ende-prognose?location_id=<uuid>
 *
 * Phase 1471 — Schicht-Ende-Prognose-API
 * Berechnung wann alle aktuellen Stopps abgeschlossen sind + ETA Schichtende.
 * Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface SchichtEndePrognose {
  aktive_touren: number;
  offene_stopps: number;
  durchschn_min_pro_stopp: number;
  geschaetztes_schichtende_iso: string;
  minuten_bis_schichtende: number;
  noch_eine_tour_sinnvoll: boolean;
  empfehlung: string;
  location_id: string;
  generiert_am: string;
}

function buildMock(locationId: string): SchichtEndePrognose {
  const nowMs = Date.now();
  const minutesBis = 42;
  return {
    aktive_touren: 2,
    offene_stopps: 7,
    durchschn_min_pro_stopp: 6,
    geschaetztes_schichtende_iso: new Date(nowMs + minutesBis * 60_000).toISOString(),
    minuten_bis_schichtende: minutesBis,
    noch_eine_tour_sinnvoll: true,
    empfehlung: 'Noch 7 offene Stopps — in ca. 42 Min abgeschlossen. Eine weitere Tour ist sinnvoll.',
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

function buildEmpfehlung(min: number, offeneStopps: number, nochSinnvoll: boolean): string {
  if (offeneStopps === 0) return 'Alle Stopps abgeschlossen. Schicht kann beendet werden.';
  if (nochSinnvoll)
    return `Noch ${offeneStopps} offene Stopp${offeneStopps > 1 ? 's' : ''} — in ca. ${min} Min abgeschlossen. Eine weitere Tour ist sinnvoll.`;
  return `Noch ${offeneStopps} offene Stopp${offeneStopps > 1 ? 's' : ''} — in ca. ${min} Min abgeschlossen. Keine weitere Tour empfohlen.`;
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();

    const { data: activeBatches } = await (sb as any)
      .from('mise_delivery_batches')
      .select('id, started_at, total_eta_min')
      .eq('location_id', locationId)
      .in('state', ['assigned', 'at_restaurant', 'on_route', 'pending_acceptance']);

    const batches = (activeBatches as any[] | null) ?? [];
    if (batches.length === 0) {
      return NextResponse.json({ ...buildMock(locationId), aktive_touren: 0, offene_stopps: 0, minuten_bis_schichtende: 0, noch_eine_tour_sinnvoll: false, empfehlung: 'Keine aktiven Touren. Schicht kann beendet werden.' });
    }

    const batchIds = batches.map((b: any) => b.id);
    const { data: openStopsRaw } = await (sb as any)
      .from('mise_delivery_batch_stops')
      .select('id, batch_id, completed_at')
      .in('batch_id', batchIds)
      .is('completed_at', null);

    const offeneStopps = (openStopsRaw as any[] | null)?.length ?? 0;

    const nowMs = Date.now();
    let latestEtaMs = nowMs;
    for (const b of batches) {
      if (b.started_at && b.total_eta_min != null) {
        const etaMs = new Date(b.started_at).getTime() + b.total_eta_min * 60_000;
        if (etaMs > latestEtaMs) latestEtaMs = etaMs;
      }
    }

    const minBis = Math.max(0, Math.round((latestEtaMs - nowMs) / 60_000));
    const avgMinProStopp = offeneStopps > 0 ? Math.round(minBis / offeneStopps) : 6;
    const nochSinnvoll = minBis > 20 && offeneStopps > 0;

    const result: SchichtEndePrognose = {
      aktive_touren: batches.length,
      offene_stopps: offeneStopps,
      durchschn_min_pro_stopp: avgMinProStopp,
      geschaetztes_schichtende_iso: new Date(latestEtaMs).toISOString(),
      minuten_bis_schichtende: minBis,
      noch_eine_tour_sinnvoll: nochSinnvoll,
      empfehlung: buildEmpfehlung(minBis, offeneStopps, nochSinnvoll),
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
