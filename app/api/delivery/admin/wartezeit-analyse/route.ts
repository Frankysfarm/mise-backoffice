/**
 * GET /api/delivery/admin/wartezeit-analyse
 *
 * Wartezeit-Analyse-Engine — Phase 419
 *
 * GET ?location_id=<uuid>                       → Vollständiges Dashboard (letzte 8h)
 * GET ?location_id=<uuid>&action=trend          → Tages-Trend (letzte 7 Tage)
 * GET ?location_id=<uuid>&action=fahrer         → Fahrer-Wartezeit-Rangliste
 * GET ?location_id=<uuid>&action=kueche         → Nur Küchen-Wartezeit (für Kitchen-TV)
 * GET ?location_id=<uuid>&stunden=4             → Dashboard mit custom Zeitfenster
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getWartezeitDashboard,
  getWartezeitTrend,
  getWartezeitPerFahrer,
  getKuechenWartezeit,
} from '@/lib/delivery/wartezeit-analyse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const action     = searchParams.get('action');
  const stunden    = parseInt(searchParams.get('stunden') ?? '8', 10);
  const tage       = parseInt(searchParams.get('tage') ?? '7', 10);

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    switch (action) {
      case 'trend': {
        const trend = await getWartezeitTrend(locationId, tage);
        return NextResponse.json({ locationId, trend });
      }
      case 'fahrer': {
        const fahrer = await getWartezeitPerFahrer(locationId);
        return NextResponse.json({ locationId, fahrer });
      }
      case 'kueche': {
        const kueche = await getKuechenWartezeit(locationId);
        return NextResponse.json({ locationId, kueche });
      }
      default: {
        const dashboard = await getWartezeitDashboard(locationId, stunden);
        return NextResponse.json({ locationId, ...dashboard });
      }
    }
  } catch (err) {
    console.error('[wartezeit-analyse]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
