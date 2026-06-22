/**
 * GET /api/delivery/admin/zonen-prognose
 *
 * Zonen-Prognose-Engine — Phase 423
 *
 * GET ?location_id=<uuid>                     → 7-Tage-Prognose alle Zonen
 * GET ?location_id=<uuid>&zone=A              → 7-Tage-Prognose Zone A
 * GET ?location_id=<uuid>&action=uebersicht   → Kompakt-Übersicht (Morgen + 7d-Summe)
 * POST { action: 'compute', location_id }     → Jetzt neu berechnen + UPSERT
 * POST { action: 'compute-all' }              → Alle Standorte neu berechnen (Cron)
 * POST { action: 'prune' }                    → Alte Prognosen löschen
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getZonenPrognose,
  getZonenPrognoseUebersicht,
  computeZonenPrognose,
  computeZonenPrognoseAllLocations,
  pruneOldZonenPrognosen,
  type ZoneName,
} from '@/lib/delivery/zonen-prognose';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const action     = searchParams.get('action');
  const zone       = searchParams.get('zone') as ZoneName | null;

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    if (action === 'uebersicht') {
      const uebersicht = await getZonenPrognoseUebersicht(locationId);
      return NextResponse.json(uebersicht);
    }

    const prognose = await getZonenPrognose(locationId, zone ?? undefined);
    return NextResponse.json(prognose);
  } catch (err) {
    console.error('[zonen-prognose GET]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      action:       string;
      location_id?: string;
      days_back?:   number;
      days_old?:    number;
    };

    switch (body.action) {
      case 'compute': {
        if (!body.location_id) {
          return NextResponse.json({ error: 'location_id required' }, { status: 400 });
        }
        const result = await computeZonenPrognose(body.location_id, body.days_back ?? 90);
        return NextResponse.json({ ok: true, ...result });
      }
      case 'compute-all': {
        const result = await computeZonenPrognoseAllLocations(body.days_back ?? 90);
        return NextResponse.json({ ok: true, ...result });
      }
      case 'prune': {
        const deleted = await pruneOldZonenPrognosen(body.days_old ?? 60);
        return NextResponse.json({ ok: true, deleted });
      }
      default:
        return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
    }
  } catch (err) {
    console.error('[zonen-prognose POST]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
