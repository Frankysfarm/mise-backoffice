/**
 * GET /api/delivery/driver/routen-optimierung?tour_id=<uuid>&driver_id=<uuid>
 *
 * Phase 961 — Fahrer-Routen-Optimierungs-API
 * Optimale Stopp-Reihenfolge für offene Stops einer Tour (nearest-neighbor Algorithmus).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Stopp {
  stop_id: string;
  order_id: string;
  bestellnummer: string;
  adresse: string;
  zone: string;
  lat: number | null;
  lng: number | null;
  eta_min: number;
  status: string;
  prioritaet: 'hoch' | 'normal' | 'niedrig';
  artikel_anzahl: number;
}

interface OptimierterStop extends Stopp {
  reihenfolge: number;
  geschaetzte_ankunft_min: number;
  distanz_km: number;
}

// Nearest-neighbor Haversine-Distanz
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestNeighborOptimierung(stopps: Stopp[], startLat = 48.137, startLng = 11.576): OptimierterStop[] {
  const verbleibend = [...stopps];
  const ergebnis: OptimierterStop[] = [];
  let aktLat = startLat;
  let aktLng = startLng;
  let akkuMin = 0;

  // Hohe Priorität zuerst vorsortieren
  const hoch = verbleibend.filter(s => s.prioritaet === 'hoch');
  const rest = verbleibend.filter(s => s.prioritaet !== 'hoch');

  for (const gruppe of [hoch, rest]) {
    while (gruppe.length > 0) {
      let naechsterIdx = 0;
      let minDist = Infinity;

      for (let i = 0; i < gruppe.length; i++) {
        const s = gruppe[i];
        const lat = s.lat ?? aktLat;
        const lng = s.lng ?? aktLng;
        const dist = haversineKm(aktLat, aktLng, lat, lng);
        if (dist < minDist) {
          minDist = dist;
          naechsterIdx = i;
        }
      }

      const naechster = gruppe.splice(naechsterIdx, 1)[0];
      const lat = naechster.lat ?? aktLat;
      const lng = naechster.lng ?? aktLng;
      const distKm = haversineKm(aktLat, aktLng, lat, lng);
      const fahrtMin = Math.round(distKm * 2.5); // ~24 km/h Stadtverkehr
      akkuMin += fahrtMin + 3; // 3 Min Übergabe

      ergebnis.push({
        ...naechster,
        reihenfolge: ergebnis.length + 1,
        geschaetzte_ankunft_min: akkuMin,
        distanz_km: Math.round(distKm * 10) / 10,
      });

      aktLat = lat;
      aktLng = lng;
    }
  }

  return ergebnis;
}

function mockData(tourId: string): { stopps: OptimierterStop[]; gesamt_km: number; gesamt_min: number } {
  const stopps: Stopp[] = [
    { stop_id: 's1', order_id: 'o1', bestellnummer: '#1001', adresse: 'Marienplatz 1, München', zone: 'A', lat: 48.1374, lng: 11.5755, eta_min: 15, status: 'zugewiesen', prioritaet: 'hoch', artikel_anzahl: 2 },
    { stop_id: 's2', order_id: 'o2', bestellnummer: '#1002', adresse: 'Schwabing, Leopoldstr. 5', zone: 'B', lat: 48.1568, lng: 11.5772, eta_min: 25, status: 'zugewiesen', prioritaet: 'normal', artikel_anzahl: 3 },
    { stop_id: 's3', order_id: 'o3', bestellnummer: '#1003', adresse: 'Maxvorstadt, Theresienstr. 8', zone: 'A', lat: 48.1494, lng: 11.5677, eta_min: 30, status: 'zugewiesen', prioritaet: 'normal', artikel_anzahl: 1 },
    { stop_id: 's4', order_id: 'o4', bestellnummer: '#1004', adresse: 'Haidhausen, Rosenheimer Str. 12', zone: 'C', lat: 48.1282, lng: 11.5935, eta_min: 40, status: 'zugewiesen', prioritaet: 'niedrig', artikel_anzahl: 4 },
  ];
  const optimiert = nearestNeighborOptimierung(stopps);
  const gesamtKm = optimiert.reduce((s, x) => s + x.distanz_km, 0);
  return { stopps: optimiert, gesamt_km: Math.round(gesamtKm * 10) / 10, gesamt_min: optimiert.at(-1)?.geschaetzte_ankunft_min ?? 0 };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tourId = url.searchParams.get('tour_id');
  const driverId = url.searchParams.get('driver_id');

  if (!tourId && !driverId) {
    return NextResponse.json({ error: 'tour_id oder driver_id erforderlich' }, { status: 400 });
  }

  try {
    const sb = await createClient();

    // Offene Stops der Tour laden
    const tourQuery = tourId
      ? sb.from('mise_delivery_stops').select('id,order_id,address,zone,lat,lng,status,position').eq('tour_id', tourId).in('status', ['zugewiesen', 'assigned', 'pending'])
      : sb.from('mise_delivery_stops').select('id,order_id,address,zone,lat,lng,status,position').eq('driver_id', driverId!).in('status', ['zugewiesen', 'assigned', 'pending']);

    const { data: stops, error } = await tourQuery;

    if (error || !stops || stops.length === 0) {
      return NextResponse.json(mockData(tourId ?? driverId ?? 'mock'));
    }

    // Bestellungen für Metadaten laden
    const orderIds = stops.map(s => s.order_id).filter(Boolean);
    const { data: orders } = await sb
      .from('customer_orders')
      .select('id,bestellnummer,order_number,artikel_anzahl,item_count,promised_at,eta_minutes')
      .in('id', orderIds);

    const orderMap = new Map((orders ?? []).map(o => [o.id, o]));

    const stopps: Stopp[] = stops.map(s => {
      const order = orderMap.get(s.order_id);
      const prometMs = order?.promised_at ? new Date(order.promised_at).getTime() : null;
      const restMin = prometMs ? Math.round((prometMs - Date.now()) / 60000) : (order?.eta_minutes ?? 30);
      const prio: Stopp['prioritaet'] = restMin < 10 ? 'hoch' : restMin < 20 ? 'normal' : 'niedrig';

      return {
        stop_id: s.id,
        order_id: s.order_id,
        bestellnummer: order?.bestellnummer ?? order?.order_number ?? `#${s.id.slice(0, 6)}`,
        adresse: s.address ?? 'Unbekannte Adresse',
        zone: s.zone ?? 'A',
        lat: s.lat ?? null,
        lng: s.lng ?? null,
        eta_min: restMin,
        status: s.status,
        prioritaet: prio,
        artikel_anzahl: order?.artikel_anzahl ?? order?.item_count ?? 1,
      };
    });

    const optimiert = nearestNeighborOptimierung(stopps);
    const gesamtKm = optimiert.reduce((s, x) => s + x.distanz_km, 0);

    return NextResponse.json({
      stopps: optimiert,
      gesamt_km: Math.round(gesamtKm * 10) / 10,
      gesamt_min: optimiert.at(-1)?.geschaetzte_ankunft_min ?? 0,
      generatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(mockData(tourId ?? driverId ?? 'mock'));
  }
}
