/**
 * GET /api/delivery/health?location_id=...
 *
 * System-Health-Check für Monitoring (UptimeRobot, Vercel Analytics, etc.).
 * Ohne Auth wird nur die globale DB-Erreichbarkeit ausgegeben. Standortbezogene
 * Betriebswerte sind ausschließlich für aktive Delivery-Admins des Mandanten sichtbar.
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
import { getCurrentCoverageStatus } from '@/lib/delivery/shifts';
import { getDeliveryAdminActor, isDeliveryAdminLocation } from '@/lib/delivery/admin-auth';

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
    database: { ok: false },
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

  if (!locationId) {
    return NextResponse.json({
      status: 'ok',
      checks,
      timestamp: new Date().toISOString(),
    });
  }

  const actor = await getDeliveryAdminActor();
  if (!actor) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });
  if (!await isDeliveryAdminLocation(actor, locationId)) {
    return NextResponse.json({ error: 'Standort nicht autorisiert' }, { status: 403 });
  }

  checks.zones_configured = { ok: true, count: 0 };
  checks.drivers_online = { ok: true, count: 0 };
  checks.dispatch_backlog = { ok: true, pending: 0 };
  checks.shift_coverage = { ok: true, uncovered_slots: 0 };

  // 2. Zonen konfiguriert
  const { count: zoneCount } = await sb
    .from('delivery_zones')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('active', true);

  checks.zones_configured = { ok: (zoneCount ?? 0) > 0, count: zoneCount ?? 0 };

  // 3. Online-Fahrer des Mandanten (mise_drivers selbst hat keine tenant_id)
  const { data: memberships } = await sb
    .from('mise_driver_tenants')
    .select('driver_id')
    .eq('tenant_id', actor.tenant_id as string)
    .eq('status', 'active');
  const driverIds = (memberships ?? []).map((membership) => membership.driver_id as string);
  const driverCount = driverIds.length > 0
    ? (await sb
      .from('mise_drivers')
      .select('id', { count: 'exact', head: true })
      .in('id', driverIds)
      .eq('active', true)
      .in('state', ['idle', 'assigned', 'at_restaurant', 'en_route', 'returning'])).count
    : 0;

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

  // 5. Schicht-Abdeckung (nächste Stunde)
  const coverage = await getCurrentCoverageStatus(locationId).catch(() => ({
    uncovered_slots: 0, understaffed_slots: 0,
  }));
  checks.shift_coverage = {
    ok: coverage.uncovered_slots === 0,
    uncovered_slots:    coverage.uncovered_slots,
    understaffed_slots: coverage.understaffed_slots,
  };

  const allOk      = Object.values(checks).every((c) => c.ok);
  const criticalOk = checks.database.ok;
  const status     = !criticalOk ? 'down' : allOk ? 'ok' : 'degraded';

  return NextResponse.json(
    { status, checks, timestamp: new Date().toISOString() },
    { status: status === 'down' ? 503 : 200 },
  );
}
