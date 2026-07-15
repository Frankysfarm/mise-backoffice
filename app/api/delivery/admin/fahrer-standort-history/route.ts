/**
 * GET /api/delivery/admin/fahrer-standort-history?location_id=<uuid>
 *
 * Phase 1722 — Fahrer-Standort-History-API (Backend)
 * GPS-Punkte der letzten 2h je Fahrer; Route-Länge km; Dwell-Time je Stopp.
 * Multi-Tenant via location_id. Supabase delivery_tours + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface GpsPunkt {
  lat: number;
  lng: number;
  ts: string;
}

export interface StoppDwell {
  stopp_nr: number;
  adresse: string;
  dwell_sec: number;
  lat: number;
  lng: number;
}

export interface FahrerStandortHistory {
  driver_id: string;
  fahrer_name: string;
  punkte: GpsPunkt[];
  route_km: number;
  stopps: StoppDwell[];
  letzter_punkt: GpsPunkt | null;
}

export interface FahrerStandortHistoryResponse {
  fahrer: FahrerStandortHistory[];
  location_id: string;
  zeitraum_stunden: number;
  generiert_am: string;
}

function haversineKm(a: GpsPunkt, b: GpsPunkt): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function routeKm(punkte: GpsPunkt[]): number {
  let km = 0;
  for (let i = 1; i < punkte.length; i++) {
    km += haversineKm(punkte[i - 1], punkte[i]);
  }
  return Math.round(km * 10) / 10;
}

function buildMock(locationId: string): FahrerStandortHistoryResponse {
  const baseLat = 50.776;
  const baseLng = 6.083;
  const now = Date.now();

  const makePunkte = (offsetLat: number, offsetLng: number): GpsPunkt[] => {
    const pts: GpsPunkt[] = [];
    for (let i = 12; i >= 0; i--) {
      pts.push({
        lat: baseLat + offsetLat + (Math.random() * 0.004 - 0.002) * i,
        lng: baseLng + offsetLng + (Math.random() * 0.004 - 0.002) * i,
        ts: new Date(now - i * 10 * 60_000).toISOString(),
      });
    }
    return pts;
  };

  const makeStopps = (punkte: GpsPunkt[]): StoppDwell[] => [
    { stopp_nr: 1, adresse: 'Musterstr. 12', dwell_sec: 90, lat: punkte[2].lat, lng: punkte[2].lng },
    { stopp_nr: 2, adresse: 'Beispielweg 5', dwell_sec: 65, lat: punkte[6].lat, lng: punkte[6].lng },
    { stopp_nr: 3, adresse: 'Testgasse 3', dwell_sec: 110, lat: punkte[10].lat, lng: punkte[10].lng },
  ];

  const makeFahrer = (driver_id: string, fahrer_name: string, offsetLat: number, offsetLng: number): FahrerStandortHistory => {
    const punkte = makePunkte(offsetLat, offsetLng);
    return {
      driver_id,
      fahrer_name,
      punkte,
      route_km: routeKm(punkte),
      stopps: makeStopps(punkte),
      letzter_punkt: punkte[punkte.length - 1] ?? null,
    };
  };

  const fahrer: FahrerStandortHistory[] = [
    makeFahrer('mock-1', 'Max Müller', 0, 0),
    makeFahrer('mock-2', 'Anna Schmidt', 0.01, 0.01),
    makeFahrer('mock-3', 'Klaus Weber', -0.01, 0.005),
  ];

  return { fahrer, location_id: locationId, zeitraum_stunden: 2, generiert_am: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();
    const vor2h = new Date(Date.now() - 2 * 3600_000).toISOString();

    const { data: touren, error } = await sb
      .from('delivery_tours')
      .select('id, driver_id, started_at, completed_at, stops, estimated_duration_min, status')
      .eq('location_id', locationId)
      .gte('started_at', vor2h)
      .in('status', ['unterwegs', 'on_route', 'gestartet', 'completed', 'abgeschlossen']);

    if (error || !touren?.length) return NextResponse.json(buildMock(locationId));

    const fahrerMap: Record<string, FahrerStandortHistory> = {};

    for (const t of touren as {
      id: string;
      driver_id?: string | null;
      started_at?: string | null;
      stops?: Array<{ lat?: number; lng?: number; address?: string; arrived_at?: string; departed_at?: string }> | null;
    }[]) {
      if (!t.driver_id) continue;
      if (!fahrerMap[t.driver_id]) {
        fahrerMap[t.driver_id] = {
          driver_id: t.driver_id,
          fahrer_name: `Fahrer ${t.driver_id.slice(0, 6)}`,
          punkte: [],
          route_km: 0,
          stopps: [],
          letzter_punkt: null,
        };
      }
      const entry = fahrerMap[t.driver_id];

      const stops = t.stops ?? [];
      stops.forEach((s, idx) => {
        if (s.lat == null || s.lng == null) return;
        const ts = s.arrived_at ?? t.started_at ?? new Date().toISOString();
        entry.punkte.push({ lat: s.lat, lng: s.lng, ts });
        entry.stopps.push({
          stopp_nr: idx + 1,
          adresse: s.address ?? `Stopp ${idx + 1}`,
          dwell_sec: s.arrived_at && s.departed_at
            ? Math.floor((new Date(s.departed_at).getTime() - new Date(s.arrived_at).getTime()) / 1000)
            : 0,
          lat: s.lat,
          lng: s.lng,
        });
      });
    }

    const result = Object.values(fahrerMap).map(f => {
      f.punkte.sort((a, b) => a.ts.localeCompare(b.ts));
      f.route_km = routeKm(f.punkte);
      f.letzter_punkt = f.punkte[f.punkte.length - 1] ?? null;
      return f;
    });

    if (!result.length) return NextResponse.json(buildMock(locationId));

    return NextResponse.json({
      fahrer: result,
      location_id: locationId,
      zeitraum_stunden: 2,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerStandortHistoryResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
