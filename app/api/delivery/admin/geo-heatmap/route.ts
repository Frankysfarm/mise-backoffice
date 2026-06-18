/**
 * GET /api/delivery/admin/geo-heatmap
 *   ?action=dashboard|live|historical|zone-hourly|geojson
 *   &location_id=...
 *   &days=30           (historisch)
 *   &include_drivers=1 (GeoJSON)
 *
 * Phase 244 — Smart Delivery Geo-Heatmap Pro
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getDashboard,
  getLiveHeatmap,
  getHistoricalHeatmap,
  getZoneHourlyUtilization,
  exportGeoJSON,
} from '@/lib/delivery/geo-heatmap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') ?? 'dashboard';
  const locationIdParam = searchParams.get('location_id');
  const days = Math.min(90, Math.max(1, Number(searchParams.get('days') ?? '30')));
  const includeDrivers = searchParams.get('include_drivers') === '1';

  // Auth: employee muss zur Location gehören
  const { data: emp } = await sb
    .from('employees')
    .select('location_id, tenant_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!emp) return NextResponse.json({ error: 'Kein Mitarbeiter-Datensatz' }, { status: 403 });

  let locationId: string;
  if (locationIdParam && emp.role === 'superadmin') {
    locationId = locationIdParam;
  } else {
    locationId = (emp.location_id as string | null) ?? '';
  }
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  switch (action) {
    case 'live':
      return NextResponse.json(await getLiveHeatmap(locationId));

    case 'historical':
      return NextResponse.json({
        cells: await getHistoricalHeatmap(locationId, days),
        days,
      });

    case 'zone-hourly':
      return NextResponse.json({
        zones: await getZoneHourlyUtilization(locationId),
      });

    case 'geojson': {
      const geojson = await exportGeoJSON(locationId, {
        days,
        includeLive: true,
        includeDrivers,
      });
      return new NextResponse(JSON.stringify(geojson), {
        status: 200,
        headers: {
          'Content-Type': 'application/geo+json',
          'Content-Disposition': `attachment; filename="heatmap-${locationId}-${new Date().toISOString().slice(0, 10)}.geojson"`,
        },
      });
    }

    case 'dashboard':
    default:
      return NextResponse.json(await getDashboard(locationId));
  }
}
