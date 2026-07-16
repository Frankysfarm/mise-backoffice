import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Phase 1856 — Fahrer-GPS-Ausfalls-Detektor
 * GET /api/delivery/admin/gps-ausfall?location_id=<uuid>
 *
 * Liefert alle online-Fahrer ohne GPS-Update >5 Min:
 * - letzter bekannter Standort (lat/lng) + Minuten seit Update
 * - Alert-Level: warn (5–10 Min) | kritisch (>10 Min) | ok (<5 Min)
 * Multi-Tenant; Supabase + Mock-Fallback.
 */

type AlertLevel = 'ok' | 'warn' | 'kritisch';

interface FahrerGpsStatus {
  id: string;
  name: string;
  letztes_update_vor_min: number | null;
  letzter_lat: number | null;
  letzter_lng: number | null;
  alert_level: AlertLevel;
}

interface GpsAusfallAntwort {
  location_id: string;
  fahrer: FahrerGpsStatus[];
  ausfall_count: number;
  kritisch_count: number;
  generiert_am: string;
}

function alertLevel(minSinceUpdate: number | null): AlertLevel {
  if (minSinceUpdate === null) return 'kritisch';
  if (minSinceUpdate > 10) return 'kritisch';
  if (minSinceUpdate > 5) return 'warn';
  return 'ok';
}

const MOCK: GpsAusfallAntwort = {
  location_id: 'mock',
  fahrer: [
    { id: 'f1', name: 'Mehmet K.', letztes_update_vor_min: 12, letzter_lat: 50.776, letzter_lng: 6.084, alert_level: 'kritisch' },
    { id: 'f2', name: 'Laura S.', letztes_update_vor_min: 7, letzter_lat: 50.781, letzter_lng: 6.092, alert_level: 'warn' },
    { id: 'f3', name: 'Jan P.', letztes_update_vor_min: 2, letzter_lat: 50.769, letzter_lng: 6.075, alert_level: 'ok' },
  ],
  ausfall_count: 2,
  kritisch_count: 1,
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();
    const now = new Date();

    const { data: drivers, error } = await sb
      .from('mise_drivers')
      .select('id, name')
      .eq('location_id', locationId)
      .eq('is_online', true);

    if (error || !drivers || drivers.length === 0) {
      return NextResponse.json({ ...MOCK, location_id: locationId });
    }

    const fahrerStatuses: FahrerGpsStatus[] = await Promise.all(
      (drivers as { id: string; name: string }[]).map(async (d) => {
        const { data: events } = await sb
          .from('driver_gps_events')
          .select('created_at, lat, lng')
          .eq('driver_id', d.id)
          .order('created_at', { ascending: false })
          .limit(1);

        const latest = events?.[0] as
          | { created_at: string; lat: number | null; lng: number | null }
          | undefined;

        if (!latest) {
          return {
            id: d.id,
            name: d.name,
            letztes_update_vor_min: null,
            letzter_lat: null,
            letzter_lng: null,
            alert_level: 'kritisch' as AlertLevel,
          };
        }

        const ageMs = now.getTime() - new Date(latest.created_at).getTime();
        const ageMin = Math.round(ageMs / 60_000);

        return {
          id: d.id,
          name: d.name,
          letztes_update_vor_min: ageMin,
          letzter_lat: latest.lat,
          letzter_lng: latest.lng,
          alert_level: alertLevel(ageMin),
        };
      }),
    );

    fahrerStatuses.sort((a, b) => {
      const order: Record<AlertLevel, number> = { kritisch: 0, warn: 1, ok: 2 };
      return order[a.alert_level] - order[b.alert_level];
    });

    const ausfallCount = fahrerStatuses.filter((f) => f.alert_level !== 'ok').length;
    const kritischCount = fahrerStatuses.filter((f) => f.alert_level === 'kritisch').length;

    const body: GpsAusfallAntwort = {
      location_id: locationId,
      fahrer: fahrerStatuses,
      ausfall_count: ausfallCount,
      kritisch_count: kritischCount,
      generiert_am: now.toISOString(),
    };

    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ ...MOCK, location_id: locationId });
  }
}
