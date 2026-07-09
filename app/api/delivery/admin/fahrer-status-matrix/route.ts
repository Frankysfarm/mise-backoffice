import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Phase 993 — Fahrer-Status-Matrix API
 *
 * GET /api/delivery/admin/fahrer-status-matrix?location_id=...
 * Gibt alle Fahrer mit Status (Online/Pause/Offline), Zone, verbleibende Stopps + ETR.
 */

export const dynamic = 'force-dynamic';

interface FahrerStatus {
  fahrer_id: string;
  name: string;
  status: 'online' | 'pause' | 'offline';
  zone: string | null;
  verbleibende_stopps: number;
  etr_min: number | null;
  fahrzeug: string;
}

const MOCK: FahrerStatus[] = [
  { fahrer_id: 'f1', name: 'M. Bauer', status: 'online', zone: 'A', verbleibende_stopps: 2, etr_min: 14, fahrzeug: '🚲' },
  { fahrer_id: 'f2', name: 'L. Huber', status: 'online', zone: 'B', verbleibende_stopps: 3, etr_min: 21, fahrzeug: '🛵' },
  { fahrer_id: 'f3', name: 'K. Stein', status: 'pause', zone: null, verbleibende_stopps: 0, etr_min: null, fahrzeug: '🚗' },
  { fahrer_id: 'f4', name: 'A. König', status: 'offline', zone: null, verbleibende_stopps: 0, etr_min: null, fahrzeug: '🚲' },
  { fahrer_id: 'f5', name: 'S. Weber', status: 'online', zone: 'C', verbleibende_stopps: 1, etr_min: 7, fahrzeug: '🛵' },
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ fahrer: MOCK, online: 3, pause: 1, offline: 1, generiert_am: new Date().toISOString() });
  }

  try {
    const supabase = await createClient();

    // Get driver shift status
    const { data: schichten } = await supabase
      .from('driver_shifts')
      .select('driver_id, status, started_at')
      .eq('location_id', locationId)
      .in('status', ['active', 'pause'])
      .order('started_at', { ascending: false });

    // Get active batches with stops
    const { data: batches } = await supabase
      .from('delivery_batches')
      .select('driver_id, zone, delivery_stops(id, status)')
      .eq('location_id', locationId)
      .in('status', ['dispatched', 'unterwegs', 'in_delivery', 'abgeholt']);

    // Get driver profiles
    const driverIds = (schichten ?? []).map(s => s.driver_id).filter(Boolean);
    const { data: drivers } = driverIds.length
      ? await supabase
          .from('mise_drivers')
          .select('id, first_name, last_name, vehicle_type')
          .in('id', driverIds)
      : { data: [] };

    const driverMap: Record<string, { name: string; vehicle: string }> = {};
    for (const d of drivers ?? []) {
      const vehicle = d.vehicle_type === 'car' ? '🚗' : d.vehicle_type === 'scooter' ? '🛵' : '🚲';
      driverMap[d.id] = { name: `${d.first_name ?? ''} ${(d.last_name ?? '').charAt(0)}.`.trim(), vehicle };
    }

    const batchByDriver: Record<string, { zone: string; remaining: number }> = {};
    for (const b of batches ?? []) {
      if (!b.driver_id) continue;
      const stops = Array.isArray(b.delivery_stops) ? b.delivery_stops : [];
      const remaining = stops.filter((s: any) => !['delivered', 'failed'].includes(s.status)).length;
      batchByDriver[b.driver_id] = { zone: b.zone ?? 'A', remaining };
    }

    const fahrer: FahrerStatus[] = (schichten ?? []).map(s => {
      const info = driverMap[s.driver_id] ?? { name: 'Fahrer', vehicle: '🚲' };
      const batch = batchByDriver[s.driver_id];
      return {
        fahrer_id: s.driver_id,
        name: info.name,
        status: s.status === 'pause' ? 'pause' : 'online',
        zone: batch?.zone ?? null,
        verbleibende_stopps: batch?.remaining ?? 0,
        etr_min: batch ? batch.remaining * 7 : null,
        fahrzeug: info.vehicle,
      };
    });

    const online = fahrer.filter(f => f.status === 'online').length;
    const pause = fahrer.filter(f => f.status === 'pause').length;

    return NextResponse.json({
      fahrer,
      online,
      pause,
      offline: 0,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ fahrer: MOCK, online: 3, pause: 1, offline: 1, generiert_am: new Date().toISOString() });
  }
}
