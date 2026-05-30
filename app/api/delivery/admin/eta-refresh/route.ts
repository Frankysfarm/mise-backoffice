/**
 * POST /api/delivery/admin/eta-refresh
 *
 * Manueller Trigger für Live-ETA-Aktualisierung aller on_route Batches.
 * Normalerweise läuft dies automatisch alle 2 Min via Cron.
 * Nützlich nach GPS-Lücken oder manuellen Korrekturen.
 *
 * Response:
 * {
 *   ok: true,
 *   batches_processed: number,
 *   orders_updated: number,
 *   orders_skipped: number,
 *   errors: number,
 *   duration_ms: number,
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { refreshEnRouteEtas } from '@/lib/delivery/eta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  // location_id als Hinweis — refreshEnRouteEtas() arbeitet systemweit
  const { searchParams } = new URL(req.url);
  void searchParams; // future: filter by location_id

  const start = Date.now();
  try {
    const result = await refreshEnRouteEtas();
    return NextResponse.json({
      ok: true,
      ...result,
      duration_ms: Date.now() - start,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg, duration_ms: Date.now() - start }, { status: 500 });
  }
}
