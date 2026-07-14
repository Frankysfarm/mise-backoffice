/**
 * GET /api/delivery/admin/fahrer-schicht-bilanz?location_id=<uuid>
 *
 * Phase 1567 — Fahrer-Schicht-Bilanz-API
 * Aktuelle Schichtbilanz aller Fahrer: Einnahmen + Stopps + Bewertungs-Ø + Km + Status.
 * Supabase + Mock-Fallback. Multi-Tenant: jede Query filtert location_id.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerBilanzEintrag {
  fahrer_id: string;
  fahrer_name: string;
  status: 'aktiv' | 'pause' | 'offline';
  einnahmen_eur: number;
  stopps_heute: number;
  bewertung_avg: number | null;
  km_heute: number;
  schicht_start: string | null;
}

export interface FahrerSchichtBilanzResponse {
  fahrer: FahrerBilanzEintrag[];
  gesamt_einnahmen_eur: number;
  gesamt_stopps: number;
  aktive_fahrer: number;
  location_id: string;
  generiert_am: string;
}

function buildMock(locationId: string): FahrerSchichtBilanzResponse {
  const now = new Date().toISOString();
  const fahrer: FahrerBilanzEintrag[] = [
    {
      fahrer_id: 'mock-1',
      fahrer_name: 'Max Müller',
      status: 'aktiv',
      einnahmen_eur: 87.5,
      stopps_heute: 14,
      bewertung_avg: 4.7,
      km_heute: 42,
      schicht_start: new Date(Date.now() - 5 * 3600_000).toISOString(),
    },
    {
      fahrer_id: 'mock-2',
      fahrer_name: 'Sara Klein',
      status: 'aktiv',
      einnahmen_eur: 62.0,
      stopps_heute: 10,
      bewertung_avg: 4.3,
      km_heute: 31,
      schicht_start: new Date(Date.now() - 4 * 3600_000).toISOString(),
    },
    {
      fahrer_id: 'mock-3',
      fahrer_name: 'Tom Bauer',
      status: 'pause',
      einnahmen_eur: 45.0,
      stopps_heute: 7,
      bewertung_avg: 4.0,
      km_heute: 22,
      schicht_start: new Date(Date.now() - 6 * 3600_000).toISOString(),
    },
  ];
  return {
    fahrer,
    gesamt_einnahmen_eur: fahrer.reduce((s, f) => s + f.einnahmen_eur, 0),
    gesamt_stopps: fahrer.reduce((s, f) => s + f.stopps_heute, 0),
    aktive_fahrer: fahrer.filter((f) => f.status === 'aktiv').length,
    location_id: locationId,
    generiert_am: now,
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();
    const today = new Date().toISOString().slice(0, 10);

    const { data: drivers, error: dErr } = await (sb as any)
      .from('mise_drivers')
      .select('id, name, is_online, status')
      .eq('location_id', locationId);

    if (dErr || !drivers || (drivers as unknown[]).length === 0) {
      return NextResponse.json(buildMock(locationId));
    }

    const { data: batches } = await (sb as any)
      .from('mise_delivery_batches')
      .select('driver_id, total_earnings, km_total, completed_at, created_at')
      .eq('location_id', locationId)
      .gte('created_at', `${today}T00:00:00`)
      .eq('status', 'delivered');

    const { data: ratings } = await (sb as any)
      .from('delivery_ratings')
      .select('driver_id, rating')
      .eq('location_id', locationId)
      .gte('created_at', `${today}T00:00:00`);

    type BatchRow = { driver_id: string; total_earnings: number; km_total: number; created_at: string };
    type RatingRow = { driver_id: string; rating: number };
    type DriverRow = { id: string; name: string; is_online: boolean; status: string };

    const batchArr: BatchRow[] = Array.isArray(batches) ? batches : [];
    const ratingArr: RatingRow[] = Array.isArray(ratings) ? ratings : [];

    const fahrerList: FahrerBilanzEintrag[] = (drivers as DriverRow[]).map((d) => {
      const myBatches = batchArr.filter((b) => b.driver_id === d.id);
      const myRatings = ratingArr.filter((r) => r.driver_id === d.id);
      const einnahmen = myBatches.reduce((s, b) => s + (b.total_earnings ?? 0), 0);
      const km = myBatches.reduce((s, b) => s + (b.km_total ?? 0), 0);
      const avgRating =
        myRatings.length > 0
          ? Math.round((myRatings.reduce((s, r) => s + r.rating, 0) / myRatings.length) * 10) / 10
          : null;
      const schichtStart = myBatches.length > 0 ? myBatches[0].created_at : null;

      return {
        fahrer_id: d.id,
        fahrer_name: d.name,
        status: d.is_online ? 'aktiv' : d.status === 'pause' ? 'pause' : 'offline',
        einnahmen_eur: Math.round(einnahmen * 100) / 100,
        stopps_heute: myBatches.length,
        bewertung_avg: avgRating,
        km_heute: Math.round(km),
        schicht_start: schichtStart,
      };
    });

    return NextResponse.json({
      fahrer: fahrerList,
      gesamt_einnahmen_eur: Math.round(fahrerList.reduce((s, f) => s + f.einnahmen_eur, 0) * 100) / 100,
      gesamt_stopps: fahrerList.reduce((s, f) => s + f.stopps_heute, 0),
      aktive_fahrer: fahrerList.filter((f) => f.status === 'aktiv').length,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerSchichtBilanzResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
