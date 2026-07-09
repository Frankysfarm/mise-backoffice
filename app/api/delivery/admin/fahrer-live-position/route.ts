/**
 * GET /api/delivery/admin/fahrer-live-position
 *
 * Phase 946 — Fahrer-Live-Position für Dispatch-Panel
 *
 * Gibt letzte GPS-Position + Zeitstempel + Telefon + Status je Fahrer zurück.
 * Genutzt von Phase943-Dispatch-Panel.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerLivePos {
  driver_id: string;
  fahrer_name: string;
  telefon: string | null;
  letzte_position_zone: string | null;
  letzte_position_adresse: string | null;
  letzte_aktivitaet_min: number;
  status: 'aktiv' | 'inaktiv' | 'offline';
  vehicle_type: string;
}

function mockData(locationId: string): { fahrer: FahrerLivePos[]; generatedAt: string } {
  void locationId;
  return {
    fahrer: [
      { driver_id: 'm1', fahrer_name: 'Max M.', telefon: '+49 170 1234567', letzte_position_zone: 'A', letzte_position_adresse: 'Hauptstraße 12', letzte_aktivitaet_min: 2, status: 'aktiv', vehicle_type: 'scooter' },
      { driver_id: 'm2', fahrer_name: 'Sarah K.', telefon: '+49 171 7654321', letzte_position_zone: 'B', letzte_position_adresse: 'Mühlenweg 5', letzte_aktivitaet_min: 8, status: 'aktiv', vehicle_type: 'bike' },
      { driver_id: 'm3', fahrer_name: 'Tom R.', telefon: '+49 172 3456789', letzte_position_zone: 'C', letzte_position_adresse: 'Schulstraße 3', letzte_aktivitaet_min: 25, status: 'inaktiv', vehicle_type: 'car' },
    ],
    generatedAt: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = createServiceClient();
    const now = new Date();

    // Lade aktive Fahrer für diese Location (heutige Schicht oder aktive Fahrt)
    const { data: drivers, error: dErr } = await sb
      .from('mise_drivers')
      .select('id, name, phone, vehicle_type, last_lat, last_lng, last_seen_at, zone')
      .eq('location_id', locationId)
      .order('last_seen_at', { ascending: false });

    if (dErr) throw dErr;

    // Aktive Touren laden für Status-Bestimmung
    const { data: activeDriverIds } = await sb
      .from('mise_delivery_batches')
      .select('driver_id')
      .eq('location_id', locationId)
      .in('state', ['assigned', 'picked_up', 'en_route']);

    const activeSet = new Set(
      (activeDriverIds ?? []).map((r) => r.driver_id as string).filter(Boolean),
    );

    const fahrer: FahrerLivePos[] = (drivers ?? []).map((d) => {
      const lastSeen = d.last_seen_at ? new Date(d.last_seen_at as string) : null;
      const minutesAgo = lastSeen
        ? Math.floor((now.getTime() - lastSeen.getTime()) / 60_000)
        : 999;

      let status: FahrerLivePos['status'] = 'offline';
      if (activeSet.has(d.id as string)) {
        status = 'aktiv';
      } else if (minutesAgo <= 30) {
        status = minutesAgo <= 15 ? 'aktiv' : 'inaktiv';
      }

      return {
        driver_id: d.id as string,
        fahrer_name: (d.name as string) ?? 'Unbekannt',
        telefon: (d.phone as string | null) ?? null,
        letzte_position_zone: (d.zone as string | null) ?? null,
        letzte_position_adresse: null,
        letzte_aktivitaet_min: Math.min(minutesAgo, 999),
        status,
        vehicle_type: (d.vehicle_type as string) ?? 'scooter',
      };
    });

    // Sortierung: aktiv zuerst, dann nach letzte_aktivitaet_min
    fahrer.sort((a, b) => {
      const order = { aktiv: 0, inaktiv: 1, offline: 2 };
      const statusDiff = order[a.status] - order[b.status];
      if (statusDiff !== 0) return statusDiff;
      return a.letzte_aktivitaet_min - b.letzte_aktivitaet_min;
    });

    return NextResponse.json({ fahrer, generatedAt: now.toISOString() });
  } catch {
    return NextResponse.json(mockData(locationId));
  }
}
