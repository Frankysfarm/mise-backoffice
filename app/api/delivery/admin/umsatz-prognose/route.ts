/**
 * GET /api/delivery/admin/umsatz-prognose
 *
 * Umsatz-Prognose-Engine — Phase 420
 *
 * GET ?location_id=<uuid>                        → 7-Tage-Prognose (aus DB, vorberechnet)
 * GET ?location_id=<uuid>&action=history         → Historische schicht_roi_daily (30 Tage)
 * GET ?location_id=<uuid>&action=history&days=60 → Historische Daten mit custom Zeitfenster
 * POST { action: 'compute', location_id }        → Jetzt neu berechnen + UPSERT
 * POST { action: 'compute-all' }                 → Alle Standorte neu berechnen (Cron)
 * POST { action: 'prune' }                       → Alte Prognosen löschen
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getUmsatzPrognose,
  getUmsatzPrognoseHistory,
  computeUmsatzPrognose,
  computeUmsatzPrognoseAllLocations,
  pruneOldUmsatzPrognosen,
} from '@/lib/delivery/umsatz-prognose';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const action     = searchParams.get('action');
  const days       = parseInt(searchParams.get('days') ?? '30', 10);

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    if (action === 'history') {
      const history = await getUmsatzPrognoseHistory(locationId, days);
      return NextResponse.json({ locationId, history });
    }

    const prognose = await getUmsatzPrognose(locationId);
    return NextResponse.json(prognose);
  } catch (err) {
    console.error('[umsatz-prognose GET]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      action:      string;
      location_id?: string;
      days_back?:  number;
      days_old?:   number;
    };

    switch (body.action) {
      case 'compute': {
        if (!body.location_id) {
          return NextResponse.json({ error: 'location_id required' }, { status: 400 });
        }
        const result = await computeUmsatzPrognose(body.location_id, body.days_back ?? 90);
        return NextResponse.json({ ok: true, ...result });
      }
      case 'compute-all': {
        const result = await computeUmsatzPrognoseAllLocations(body.days_back ?? 90);
        return NextResponse.json({ ok: true, ...result });
      }
      case 'prune': {
        const deleted = await pruneOldUmsatzPrognosen(body.days_old ?? 60);
        return NextResponse.json({ ok: true, deleted });
      }
      default:
        return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
    }
  } catch (err) {
    console.error('[umsatz-prognose POST]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
