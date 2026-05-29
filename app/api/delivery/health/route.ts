/**
 * GET /api/delivery/health?location_id=...
 *
 * System-Health-Check für Monitoring (UptimeRobot, Vercel Analytics, etc.).
 * Kein Auth erforderlich — gibt nur nicht-sensible Aggregatwerte zurück.
 *
 * Response:
 * {
 *   status: 'ok' | 'degraded' | 'down'
 *   checks: {
 *     database:         { ok: boolean }
 *     zones_configured: { ok: boolean; count: number }
 *     drivers_online:   { ok: boolean; count: number }
 *     dispatch_backlog: { ok: boolean; pending: number }  // ok = pending < 20
 *   }
 *   timestamp: string (ISO)
 * }
 *
 * HTTP 200 = ok | degraded
 * HTTP 503 = down (DB nicht erreichbar)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CheckResult {
  ok: boolean;
  [key: string]: unknown;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  const checks: Record<string, CheckResult> = {
    database:         { ok: false },
    zones_configured: { ok: false, count: 0 },
    drivers_online:   { ok: true,  count: 0 },
    dispatch_backlog: { ok: true,  pending: 0 },
  };

  const sb = createServiceClient();

  // 1. DB-Konnektivität
  const { error: pingErr } = await sb.from('delivery_zones').select('id').limit(1);
  checks.database = { ok: !pingErr };

  if (pingErr) {
    return NextResponse.json(
      { status: 'down', checks, timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }

  // Location-spezifische Checks nur wenn location_id vorhanden
  if (locationId) {
    // 2. Zonen konfiguriert
    const { count: zoneCount } = await sb
      .from('delivery_zones')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('active', true);

    checks.zones_configured = { ok: (zoneCount ?? 0) > 0, count: zoneCount ?? 0 };

    // 3. Online-Fahrer
    const { count: driverCount } = await sb
      .from('mise_drivers')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('active', true)
      .in('state', ['available', 'on_delivery']);

    checks.drivers_online = { ok: true, count: driverCount ?? 0 };

    // 4. Dispatch-Backlog (unvermittelte Lieferungen)
    const { count: pendingCount } = await sb
      .from('customer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('typ', 'lieferung')
      .is('mise_batch_id', null)
      .not('status', 'in', '(storniert,abgeschlossen,geliefert)');

    const pending = pendingCount ?? 0;
    checks.dispatch_backlog = { ok: pending < 20, pending };
  }

  const allOk      = Object.values(checks).every((c) => c.ok);
  const criticalOk = checks.database.ok;
  const status     = !criticalOk ? 'down' : allOk ? 'ok' : 'degraded';

  return NextResponse.json(
    { status, checks, timestamp: new Date().toISOString() },
    { status: status === 'down' ? 503 : 200 },
  );
}
