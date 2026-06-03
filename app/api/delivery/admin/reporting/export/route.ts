/**
 * GET /api/delivery/admin/reporting/export
 *
 * CSV-Export-Endpunkt — Phase 26
 *
 * Query-Parameter:
 *   format        — Pflicht: 'orders' | 'drivers'
 *   location_id   — Pflicht
 *   from          — ISO-8601 UTC für 'orders'; YYYY-MM-DD für 'drivers' (default: 30 Tage zurück)
 *   to            — ISO-8601 UTC für 'orders'; YYYY-MM-DD für 'drivers' (default: heute)
 *
 * Response:
 *   Content-Type: text/csv; charset=utf-8
 *   Content-Disposition: attachment; filename="mise-orders-YYYY-MM-DD.csv"
 *
 * Sicherheit: Auth-Guard (eingeloggter Admin)
 * Limits: max. 10 000 Zeilen für 'orders', unbegrenzt für 'drivers' (via View)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateOrdersCSV, generateDriversCSV } from '@/lib/delivery/reporting';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const format     = searchParams.get('format');
  const locationId = searchParams.get('location_id');

  if (!format)     return NextResponse.json({ error: 'format fehlt (orders | drivers)' }, { status: 400 });
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const todayIso = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  try {
    if (format === 'orders') {
      const from = searchParams.get('from') ?? new Date(Date.now() - 30 * 86_400_000).toISOString();
      const to   = searchParams.get('to')   ?? new Date().toISOString();

      const csv      = await generateOrdersCSV(locationId, from, to);
      const filename = `mise-orders-${todayIso}.csv`;

      return new NextResponse(csv, {
        headers: {
          'Content-Type':        'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control':       'no-store',
        },
      });
    }

    if (format === 'drivers') {
      const from = searchParams.get('from') ?? thirtyDaysAgo;
      const to   = searchParams.get('to')   ?? todayIso;

      const csv      = await generateDriversCSV(locationId, from, to);
      const filename = `mise-drivers-${todayIso}.csv`;

      return new NextResponse(csv, {
        headers: {
          'Content-Type':        'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control':       'no-store',
        },
      });
    }

    return NextResponse.json(
      { error: `Unbekanntes format: ${format}. Erlaubt: orders, drivers` },
      { status: 400 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Export fehlgeschlagen' },
      { status: 500 },
    );
  }
}
