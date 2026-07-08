/**
 * GET /api/delivery/driver/navigations-effizienz?driver_id=...&location_id=...
 *
 * Phase 817 — Navigations-Effizienz-Score
 * Vergleich GPS-Direktweg (Haversine) vs. tatsächlich gefahrene km je Fahrer heute.
 * Effizienz = direktweg_km / tatsaechlich_km * 100
 *
 * Response: { ok, data: EffizienzDaten }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface EffizienzDaten {
  direktwegKm: number;
  tatsaechlichKm: number;
  effizienzPct: number;
  hinweis: string | null;
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

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const driverId = searchParams.get('driver_id');
  const locationId = searchParams.get('location_id');
  if (!driverId || !locationId) {
    return NextResponse.json({ error: 'driver_id und location_id erforderlich' }, { status: 400 });
  }

  const ssb = createServiceClient();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // Heutige abgeschlossene Batches dieses Fahrers
  const { data: batchRows } = await ssb
    .from('mise_delivery_batches')
    .select('id, km_start, km_end')
    .eq('location_id', locationId)
    .eq('driver_id', driverId)
    .in('status', ['abgeschlossen', 'completed'])
    .gte('completed_at', todayStart.toISOString());

  const batches = (batchRows ?? []) as { id: string; km_start: number | null; km_end: number | null }[];

  // Tatsächlich gefahrene km aus km_end - km_start
  const tatsaechlichKm = batches.reduce((acc, b) => {
    if (b.km_start != null && b.km_end != null && b.km_end > b.km_start) {
      return acc + (b.km_end - b.km_start);
    }
    return acc;
  }, 0);

  // Stopps für Direktweg-Berechnung
  const batchIds = batches.map((b) => b.id);
  let direktwegKm = 0;

  if (batchIds.length > 0) {
    const { data: stopRows } = await ssb
      .from('mise_delivery_stops')
      .select('batch_id, lat, lng, sort_order')
      .in('batch_id', batchIds)
      .order('sort_order');

    const stops = (stopRows ?? []) as {
      batch_id: string;
      lat: number | null;
      lng: number | null;
      sort_order: number;
    }[];

    // Direktweg = Summe der Haversine-Distanzen zwischen aufeinanderfolgenden Stopps je Batch
    for (const batchId of batchIds) {
      const batchStops = stops.filter((s) => s.batch_id === batchId);
      for (let i = 0; i < batchStops.length - 1; i++) {
        const a = batchStops[i];
        const b = batchStops[i + 1];
        if (a.lat && a.lng && b.lat && b.lng) {
          direktwegKm += haversineKm(a.lat, a.lng, b.lat, b.lng);
        }
      }
    }
  }

  // Fallback wenn keine Daten
  if (direktwegKm === 0 && tatsaechlichKm === 0) {
    const fallback: EffizienzDaten = {
      direktwegKm: 0,
      tatsaechlichKm: 0,
      effizienzPct: 100,
      hinweis: 'Noch keine abgeschlossenen Touren heute.',
    };
    return NextResponse.json({ ok: true, data: fallback });
  }

  const effektiv = tatsaechlichKm > 0 ? direktwegKm : direktwegKm;
  const basis = tatsaechlichKm > 0 ? tatsaechlichKm : direktwegKm;
  const effizienzPct = Math.min(100, Math.round((effektiv / Math.max(basis, 0.01)) * 100));

  const hinweis =
    effizienzPct < 75
      ? 'Tipp: Optimiere deine Route — du fährst deutlich mehr als der direkte Weg.'
      : effizienzPct < 90
      ? 'Tipp: Leichtes Optimierungspotenzial — prüfe alternative Routen.'
      : null;

  const data: EffizienzDaten = {
    direktwegKm: Math.round(direktwegKm * 10) / 10,
    tatsaechlichKm: Math.round(tatsaechlichKm * 10) / 10,
    effizienzPct,
    hinweis,
  };

  return NextResponse.json({ ok: true, data });
}
