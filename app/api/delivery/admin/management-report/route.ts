/**
 * GET /api/delivery/admin/management-report
 *
 * Management-Report-Engine — Phase 424
 *
 * GET ?location_id=<uuid>                     → Letzte 4 Wochenberichte
 * GET ?location_id=<uuid>&action=latest       → Aktuellster Wochenbericht
 * POST { action: 'compute', location_id }     → Jetzt neu berechnen (Vorwoche)
 * POST { action: 'compute-all' }              → Alle Standorte (Cron)
 * POST { action: 'prune' }                    → Alte Berichte löschen
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getManagementReports,
  getLatestManagementReport,
  computeManagementReport,
  computeManagementReportAllLocations,
  pruneOldManagementReports,
} from '@/lib/delivery/management-report';

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
    if (action === 'latest') {
      const report = await getLatestManagementReport(locationId);
      return NextResponse.json(report);
    }

    const reports = await getManagementReports(locationId, 4);
    return NextResponse.json(reports);
  } catch (err) {
    console.error('[management-report GET]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      action:       string;
      location_id?: string;
      week_offset?: number;
      weeks_keep?:  number;
    };

    switch (body.action) {
      case 'compute': {
        if (!body.location_id) {
          return NextResponse.json({ error: 'location_id required' }, { status: 400 });
        }
        const result = await computeManagementReport(body.location_id, body.week_offset ?? 1);
        return NextResponse.json({ ok: true, ...result });
      }
      case 'compute-all': {
        const result = await computeManagementReportAllLocations(body.week_offset ?? 1);
        return NextResponse.json({ ok: true, ...result });
      }
      case 'prune': {
        const deleted = await pruneOldManagementReports(body.weeks_keep ?? 52);
        return NextResponse.json({ ok: true, deleted });
      }
      default:
        return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
    }
  } catch (err) {
    console.error('[management-report POST]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
