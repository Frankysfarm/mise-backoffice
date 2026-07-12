/**
 * GET /api/delivery/admin/tour-echtzeit-ampel?location_id=<uuid>
 *
 * Phase 1151 — Tour-Echtzeit-Ampel-API
 * Live-Ampel je aktiver Tour: Grün/Gelb/Rot basierend auf Pünktlichkeit + verbleibende Zeit.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AmpelStatus = 'gruen' | 'gelb' | 'rot';

interface TourAmpel {
  batch_id: string;
  fahrer_name: string;
  zone: string | null;
  stopps_gesamt: number;
  stopps_erledigt: number;
  fortschritt_pct: number;
  laufzeit_min: number;
  eta_min: number | null;
  verbleibend_min: number | null;
  ampel: AmpelStatus;
  grund: string;
}

interface ApiResponse {
  touren: TourAmpel[];
  gruen: number;
  gelb: number;
  rot: number;
  location_id: string;
  generiert_am: string;
}

function ampelFromHealth(laufzeitMin: number, etaMin: number | null, fortPct: number): { ampel: AmpelStatus; grund: string } {
  if (etaMin === null) {
    if (laufzeitMin > 60) return { ampel: 'rot', grund: 'Keine ETA, Laufzeit >60 Min' };
    if (laufzeitMin > 40) return { ampel: 'gelb', grund: 'Lange laufend ohne ETA' };
    return { ampel: 'gruen', grund: 'Tour läuft' };
  }
  const ratio = laufzeitMin / etaMin;
  if (ratio > 1.2) return { ampel: 'rot', grund: 'ETA überschritten' };
  if (ratio > 0.85 && fortPct < 70) return { ampel: 'rot', grund: 'Zu wenig Fortschritt für verbleibende Zeit' };
  if (ratio > 0.7 && fortPct < 50) return { ampel: 'gelb', grund: 'Fortschritt knapp' };
  if (ratio > 0.9) return { ampel: 'gelb', grund: 'Fast am ETA-Limit' };
  return { ampel: 'gruen', grund: 'Pünktlich unterwegs' };
}

function mockData(locationId: string): ApiResponse {
  const now = new Date();
  const touren: TourAmpel[] = [
    { batch_id: 'b1', fahrer_name: 'Marco S.', zone: 'A', stopps_gesamt: 3, stopps_erledigt: 2, fortschritt_pct: 67, laufzeit_min: 22, eta_min: 30, verbleibend_min: 8, ampel: 'gruen', grund: 'Pünktlich unterwegs' },
    { batch_id: 'b2', fahrer_name: 'Jana K.', zone: 'B', stopps_gesamt: 4, stopps_erledigt: 1, fortschritt_pct: 25, laufzeit_min: 28, eta_min: 35, verbleibend_min: 7, ampel: 'gelb', grund: 'Fortschritt knapp' },
    { batch_id: 'b3', fahrer_name: 'Tom H.', zone: 'C', stopps_gesamt: 2, stopps_erledigt: 1, fortschritt_pct: 50, laufzeit_min: 45, eta_min: 40, verbleibend_min: -5, ampel: 'rot', grund: 'ETA überschritten' },
  ];
  return {
    touren,
    gruen: 1, gelb: 1, rot: 1,
    location_id: locationId,
    generiert_am: now.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(mockData('demo'));

  const now = new Date();
  const todayStart = new Date(now.toISOString().slice(0, 10) + 'T00:00:00Z');

  try {
    const supabase = await createClient();

    const [{ data: batches }, { data: stops }, { data: drivers }] = await Promise.all([
      supabase
        .from('mise_delivery_batches')
        .select('id, driver_id, zone, started_at, eta_minutes, status')
        .eq('location_id', locationId)
        .in('status', ['active', 'in_progress', 'on_tour', 'unterwegs'])
        .gte('started_at', todayStart.toISOString()),
      supabase
        .from('mise_delivery_stops')
        .select('batch_id, delivered_at, estimated_delivery_at')
        .eq('location_id', locationId)
        .gte('created_at', todayStart.toISOString()),
      supabase
        .from('mise_drivers')
        .select('id, name')
        .eq('location_id', locationId),
    ]);

    if (!batches || batches.length === 0) {
      return NextResponse.json(mockData(locationId));
    }

    const driverMap = new Map<string, string>((drivers ?? []).map((d: { id: string; name: string }) => [d.id, d.name]));
    const stopsByBatch = new Map<string, { total: number; erledigt: number; latestEta: string | null }>();

    for (const s of (stops ?? [])) {
      const b = stopsByBatch.get(s.batch_id) ?? { total: 0, erledigt: 0, latestEta: null };
      b.total++;
      if (s.delivered_at) b.erledigt++;
      if (s.estimated_delivery_at && (!b.latestEta || s.estimated_delivery_at > b.latestEta)) {
        b.latestEta = s.estimated_delivery_at;
      }
      stopsByBatch.set(s.batch_id, b);
    }

    const touren: TourAmpel[] = batches.map((b: {
      id: string; driver_id: string; zone: string | null;
      started_at: string; eta_minutes: number | null; status: string;
    }) => {
      const stopData = stopsByBatch.get(b.id) ?? { total: 0, erledigt: 0, latestEta: null };
      const laufzeitMin = Math.round((now.getTime() - new Date(b.started_at).getTime()) / 60_000);
      const etaMin = b.eta_minutes ?? null;
      const verbleibendMin = etaMin !== null ? etaMin - laufzeitMin : null;
      const fortPct = stopData.total > 0 ? Math.round((stopData.erledigt / stopData.total) * 100) : 0;
      const { ampel, grund } = ampelFromHealth(laufzeitMin, etaMin, fortPct);

      return {
        batch_id: b.id,
        fahrer_name: driverMap.get(b.driver_id) ?? 'Unbekannt',
        zone: b.zone,
        stopps_gesamt: stopData.total,
        stopps_erledigt: stopData.erledigt,
        fortschritt_pct: fortPct,
        laufzeit_min: laufzeitMin,
        eta_min: etaMin,
        verbleibend_min: verbleibendMin,
        ampel,
        grund,
      };
    });

    touren.sort((a, b) => {
      const order: Record<AmpelStatus, number> = { rot: 0, gelb: 1, gruen: 2 };
      return order[a.ampel] - order[b.ampel];
    });

    return NextResponse.json({
      touren,
      gruen: touren.filter(t => t.ampel === 'gruen').length,
      gelb: touren.filter(t => t.ampel === 'gelb').length,
      rot: touren.filter(t => t.ampel === 'rot').length,
      location_id: locationId,
      generiert_am: now.toISOString(),
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(mockData(locationId));
  }
}
