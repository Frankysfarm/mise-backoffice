/**
 * GET  /api/delivery/admin/fahrer-erreichbarkeit
 *
 * Phase 426 — Fahrer-Erreichbarkeits-Engine
 *
 * GET  ?location_id=<uuid>              → Dashboard (heutige Pings, Ampelstatus)
 * GET  ?location_id=<uuid>&action=next  → Nächste-Schicht-Übersicht (Kompakt)
 * POST { action: 'ping',        location_id }   → Schichten der nächsten 35 Min pingen
 * POST { action: 'ping-all' }                   → Alle Standorte pingen (Cron)
 * POST { action: 'answer', log_id, antwort }    → Fahrer-Antwort speichern
 * POST { action: 'prune',  days_old? }          → Alte Logs löschen
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getDashboard,
  getNextShiftOverview,
  pingUpcomingShifts,
  pingUpcomingShiftsAllLocations,
  recordAnswer,
  pruneOldLogs,
  type ErreichbarkeitAntwort,
} from '@/lib/delivery/fahrer-erreichbarkeit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const action     = searchParams.get('action');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    if (action === 'next') {
      const overview = await getNextShiftOverview(locationId);
      return NextResponse.json(overview);
    }

    const dashboard = await getDashboard(locationId);
    return NextResponse.json(dashboard);
  } catch (err) {
    console.error('[fahrer-erreichbarkeit GET]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      action:       string;
      location_id?: string;
      log_id?:      string;
      antwort?:     ErreichbarkeitAntwort;
      days_old?:    number;
    };

    switch (body.action) {
      case 'ping': {
        if (!body.location_id) {
          return NextResponse.json({ error: 'location_id required' }, { status: 400 });
        }
        const result = await pingUpcomingShifts(body.location_id);
        return NextResponse.json({ ok: true, ...result });
      }

      case 'ping-all': {
        const result = await pingUpcomingShiftsAllLocations();
        return NextResponse.json({ ok: true, ...result });
      }

      case 'answer': {
        if (!body.log_id || !body.antwort) {
          return NextResponse.json({ error: 'log_id und antwort required' }, { status: 400 });
        }
        if (!['bestätigt', 'abgelehnt'].includes(body.antwort)) {
          return NextResponse.json({ error: 'antwort muss bestätigt oder abgelehnt sein' }, { status: 400 });
        }
        const result = await recordAnswer(body.log_id, body.antwort as 'bestätigt' | 'abgelehnt');
        return NextResponse.json(result);
      }

      case 'prune': {
        const deleted = await pruneOldLogs(body.days_old ?? 30);
        return NextResponse.json({ ok: true, deleted });
      }

      default:
        return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
    }
  } catch (err) {
    console.error('[fahrer-erreichbarkeit POST]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
