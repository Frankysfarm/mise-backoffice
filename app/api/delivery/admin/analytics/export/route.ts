/**
 * GET /api/delivery/admin/analytics/export
 *
 * Phase 322 — Analytics-Export-API
 *
 * Query-Params:
 *   format   csv | pdf             (Standard: csv)
 *   from     YYYY-MM-DD            (Standard: vor 30 Tagen)
 *   to       YYYY-MM-DD            (Standard: gestern)
 *
 * Auth: employees.location_id (gleiche Logik wie /analytics GET)
 */
import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getSnapshotsForExport,
  buildCsvString,
  buildExportData,
} from '@/lib/delivery/analytics-export';
import { AnalyticsDocument } from '@/lib/pdf/analytics-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── Auth-Hilfsfunktion ───────────────────────────────────────────────────────

async function resolveLocation(req: NextRequest): Promise<{ locationId: string; locationName: string } | null> {
  const qsLoc = req.nextUrl.searchParams.get('location_id');
  const sb     = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const svc = createServiceClient();

  if (qsLoc) {
    const { data: emp } = await svc
      .from('employees')
      .select('tenant_id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (emp?.tenant_id) {
      const { data: loc } = await svc
        .from('locations')
        .select('name')
        .eq('id', qsLoc)
        .maybeSingle();
      return { locationId: qsLoc, locationName: (loc?.name as string | null) ?? qsLoc };
    }
  }

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  const locationId = (emp?.location_id as string | null) ?? null;
  if (!locationId) return null;

  const { data: loc } = await svc
    .from('locations')
    .select('name')
    .eq('id', locationId)
    .maybeSingle();

  return { locationId, locationName: (loc?.name as string | null) ?? locationId };
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const resolved = await resolveLocation(req);
  if (!resolved) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });

  const { locationId, locationName } = resolved;
  const { searchParams } = req.nextUrl;

  const format = (searchParams.get('format') ?? 'csv').toLowerCase();

  // Datumsbereich: Standard letzte 30 Tage
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const from = searchParams.get('from') ?? thirtyAgo;
  const to   = searchParams.get('to')   ?? yesterday;

  // Validierung
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'Ungültiges Datumsformat (YYYY-MM-DD erwartet)' }, { status: 400 });
  }
  if (from > to) {
    return NextResponse.json({ error: '"from" darf nicht nach "to" liegen' }, { status: 400 });
  }

  try {
    const snapshots = await getSnapshotsForExport(locationId, from, to);
    const exportData = buildExportData(locationId, locationName, from, to, snapshots);

    // Dateiname
    const slug = locationName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const fileBase = `delivery-analytics-${slug}-${from}-${to}`;

    if (format === 'pdf') {
      const buffer = await renderToBuffer(
        AnalyticsDocument({ data: exportData }) as Parameters<typeof renderToBuffer>[0],
      );
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type':        'application/pdf',
          'Content-Disposition': `attachment; filename="${fileBase}.pdf"`,
          'Cache-Control':       'no-store',
        },
      });
    }

    // Default: CSV
    const csv = buildCsvString(exportData);
    const bom = '﻿';  // UTF-8 BOM für Excel
    return new NextResponse(bom + csv, {
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileBase}.csv"`,
        'Cache-Control':       'no-store',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
