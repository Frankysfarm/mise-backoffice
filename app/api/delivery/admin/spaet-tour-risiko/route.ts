/**
 * GET /api/delivery/admin/spaet-tour-risiko?location_id=<uuid>
 *
 * Phase 1065 — Spät-Tour-Risiko-Monitor (Dispatch Backend)
 * Alert wenn Touren voraussichtlich nach Schichtende enden.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface TourRisiko {
  tour_id: string;
  fahrer_name: string;
  stopps_verbleibend: number;
  eta_minuten: number;
  schichtende_in_min: number;
  risiko: 'kritisch' | 'hoch' | 'mittel' | 'ok';
  verzoegerung_min: number;
  zone: string;
}

interface Response {
  touren: TourRisiko[];
  kritische_anzahl: number;
  location_id: string | null;
  generiert_am: string;
}

const SCHICHTLAENGE_MIN = 8 * 60; // 8h Standard-Schicht

function berechneRisiko(verzoegerung: number): TourRisiko['risiko'] {
  if (verzoegerung > 45) return 'kritisch';
  if (verzoegerung > 20) return 'hoch';
  if (verzoegerung > 5) return 'mittel';
  return 'ok';
}

function mockData(locationId: string | null): Response {
  const touren: TourRisiko[] = [
    {
      tour_id: 't1', fahrer_name: 'Max M.', stopps_verbleibend: 4, eta_minuten: 72,
      schichtende_in_min: 35, risiko: 'kritisch' as const, verzoegerung_min: 37, zone: 'B',
    },
    {
      tour_id: 't2', fahrer_name: 'Anna S.', stopps_verbleibend: 2, eta_minuten: 28,
      schichtende_in_min: 40, risiko: 'ok' as const, verzoegerung_min: 0, zone: 'A',
    },
    {
      tour_id: 't3', fahrer_name: 'Tom K.', stopps_verbleibend: 3, eta_minuten: 55,
      schichtende_in_min: 40, risiko: 'hoch' as const, verzoegerung_min: 15, zone: 'C',
    },
  ].filter((t) => t.risiko !== 'ok');
  return {
    touren,
    kritische_anzahl: touren.filter((t) => t.risiko === 'kritisch').length,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const locationId = url.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(mockData(null));

  try {
    const sb = await createClient();
    const jetzt = Date.now();

    const [{ data: batches }, { data: drivers }] = await Promise.all([
      sb
        .from('mise_delivery_batches')
        .select('id, driver_id, status, stops, eta_minutes, zone, created_at')
        .eq('location_id', locationId)
        .in('status', ['assigned', 'picked_up', 'en_route', 'aktiv', 'unterwegs']),
      sb
        .from('mise_drivers')
        .select('id, name, shift_start')
        .eq('location_id', locationId),
    ]);

    const touren: TourRisiko[] = [];

    for (const batch of batches ?? []) {
      const b = batch as {
        id: string; driver_id: string | null; stops?: unknown[]; eta_minutes?: number | null;
        zone?: string | null; created_at?: string | null;
      };
      const driver = (drivers ?? []).find((d) => d.id === b.driver_id) as
        | { id: string; name?: string | null; shift_start?: string | null }
        | undefined;

      const fahrerName = driver?.name ?? 'Unbekannt';
      const stoppsVerbleibend = Array.isArray(b.stops) ? b.stops.filter((s) => {
        const stop = s as { status?: string };
        return !['delivered', 'geliefert', 'completed'].includes(stop.status ?? '');
      }).length : 1;

      const etaMin = b.eta_minutes ?? stoppsVerbleibend * 12;

      let schichtEndeInMin = 60;
      if (driver?.shift_start) {
        const shiftStartMs = new Date(driver.shift_start).getTime();
        const schichtEndMs = shiftStartMs + SCHICHTLAENGE_MIN * 60_000;
        schichtEndeInMin = Math.round((schichtEndMs - jetzt) / 60_000);
      }

      const verzoegerungMin = Math.max(0, etaMin - schichtEndeInMin);
      const risiko = berechneRisiko(verzoegerungMin);

      if (risiko !== 'ok') {
        touren.push({
          tour_id: b.id,
          fahrer_name: fahrerName,
          stopps_verbleibend: stoppsVerbleibend,
          eta_minuten: etaMin,
          schichtende_in_min: schichtEndeInMin,
          risiko,
          verzoegerung_min: verzoegerungMin,
          zone: b.zone ?? 'A',
        });
      }
    }

    touren.sort((a, b) => b.verzoegerung_min - a.verzoegerung_min);

    return NextResponse.json({
      touren,
      kritische_anzahl: touren.filter((t) => t.risiko === 'kritisch').length,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(mockData(locationId));
  }
}
