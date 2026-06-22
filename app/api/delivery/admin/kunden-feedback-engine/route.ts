/**
 * GET /api/delivery/admin/kunden-feedback-engine
 *
 * Kunden-Feedback-Engine — Kundenbewertungs-Analytik.
 *
 * GET ?location_id=<uuid>                          → Vollständiges Dashboard
 * GET ?location_id=<uuid>&action=driver-rangliste  → Fahrer-Rangliste nach Rating
 * GET ?location_id=<uuid>&action=zone-heatmap      → Ø-Rating je Zone
 * GET ?location_id=<uuid>&action=tageszeit         → Ø-Rating je Tagesstunde
 * GET ?location_id=<uuid>&driver_id=<uuid>         → Eigene Bewertung (Fahrer-App)
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getKundenzufriedenheitsDashboard,
  getDriverRatingRangliste,
  getZoneRatingHeatmap,
  getTageszeitRating,
  getFahrerEigeneBewertung,
} from '@/lib/delivery/kunden-feedback-engine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id');
  const action     = searchParams.get('action');
  const days       = parseInt(searchParams.get('days') ?? '30', 10);

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    // Fahrer-App: eigene Bewertung
    if (driverId) {
      const bewertung = await getFahrerEigeneBewertung(driverId, locationId, days);
      return NextResponse.json({ locationId, driverId, bewertung });
    }

    switch (action) {
      case 'driver-rangliste': {
        const rangliste = await getDriverRatingRangliste(locationId);
        return NextResponse.json({ locationId, rangliste });
      }
      case 'zone-heatmap': {
        const heatmap = await getZoneRatingHeatmap(locationId);
        return NextResponse.json({ locationId, heatmap });
      }
      case 'tageszeit': {
        const tageszeit = await getTageszeitRating(locationId);
        return NextResponse.json({ locationId, tageszeit });
      }
      default: {
        const dashboard = await getKundenzufriedenheitsDashboard(locationId, days);
        return NextResponse.json({ locationId, ...dashboard });
      }
    }
  } catch (err) {
    console.error('[kunden-feedback-engine GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
