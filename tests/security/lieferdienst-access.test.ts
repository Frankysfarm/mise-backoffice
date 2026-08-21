import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Lieferdienst access boundaries', () => {
  const dataRoute = source('app/api/lieferdienst/data/route.ts');
  const acceptRoute = source('app/api/lieferdienst/orders/[id]/accept/route.ts');
  const statusRoute = source('app/api/lieferdienst/orders/[id]/status/route.ts');
  const alertRulesRoute = source('app/api/delivery/admin/alert-rules/route.ts');
  const alertsRoute = source('app/api/delivery/admin/alerts/route.ts');
  const alertRoute = source('app/api/delivery/admin/alerts/[id]/route.ts');
  const performanceRoute = source('app/api/delivery/admin/performance/route.ts');
  const pushStatsRoute = source('app/api/delivery/admin/push-stats/route.ts');
  const healthRoute = source('app/api/delivery/health/route.ts');
  const hardenedAdminLocationRoutes = [
    'app/api/delivery/admin/broadcasts/route.ts',
    'app/api/delivery/admin/delay-monitor/route.ts',
    'app/api/delivery/admin/events/route.ts',
    'app/api/delivery/admin/failed-attempts/route.ts',
    'app/api/delivery/admin/fee-config/route.ts',
    'app/api/delivery/admin/forecast/route.ts',
    'app/api/delivery/admin/gps-trails/route.ts',
    'app/api/delivery/admin/heatmap/route.ts',
    'app/api/delivery/admin/notification-config/route.ts',
    'app/api/delivery/admin/notification-log/route.ts',
    'app/api/delivery/admin/overview/route.ts',
    'app/api/delivery/admin/payout-config/route.ts',
    'app/api/delivery/admin/payouts/route.ts',
    'app/api/delivery/admin/reporting/export/route.ts',
    'app/api/delivery/admin/reporting/route.ts',
    'app/api/delivery/admin/satisfaction/route.ts',
    'app/api/delivery/admin/scheduled/route.ts',
    'app/api/delivery/admin/sla/route.ts',
    'app/api/delivery/admin/trends/route.ts',
    'app/api/delivery/admin/webhooks/[webhookId]/route.ts',
    'app/api/delivery/admin/webhooks/route.ts',
  ].map((path) => [path, source(path)] as const);
  const page = source('app/(admin)/lieferdienst/page.tsx');
  const client = source('app/(admin)/lieferdienst/client.tsx');
  const offline = source('hooks/use-offline.ts');

  it('requires manager access for the operational page', () => {
    expect(page).toContain('requireManagerPlus()');
    expect(page).not.toMatch(/kein Auth|DEV-Modus/);
  });

  it('scopes live reads to the authenticated tenant and selected location', () => {
    expect(dataRoute).toContain('getDeliveryAdminActor()');
    expect(dataRoute).toContain(".eq('tenant_id', actor.tenant_id)");
    expect(dataRoute).toContain(".eq('location_id', locationId)");
    expect(dataRoute).toContain("from('mise_driver_tenants')");
    expect(dataRoute).toContain(".gte('bestellt_am', operationalCutoff)");
    expect(dataRoute).not.toContain('DEV_TENANT_ID');
    expect(dataRoute).not.toContain('DEV_LOCATION_ID');
  });

  it.each([
    ['accept', acceptRoute],
    ['status', statusRoute],
  ])('scopes %s mutations to tenant and location', (_name, route) => {
    expect(route).toContain('getDeliveryAdminActor()');
    expect(route).toContain('isDeliveryAdminLocation(actor, locationId)');
    expect(route).toContain(".eq('tenant_id', actor.tenant_id)");
    expect(route).toContain(".eq('location_id', locationId)");
    expect(route).toContain('.maybeSingle()');
  });

  it('prevents accepting or moving orders out of sequence', () => {
    expect(acceptRoute).toContain("if (current.status !== 'neu')");
    expect(acceptRoute).toContain(".eq('status', 'neu')");
    expect(statusRoute).toContain('canTransitionDeliveryOrder(');
    expect(statusRoute).toContain(".eq('status', current.status)");
  });

  it('keeps demo orders opt-in and isolates offline data per operation scope', () => {
    expect(client).toContain("NEXT_PUBLIC_ENABLE_KDS_MOCKS === 'true'");
    expect(client).toContain('if (!ENABLE_KDS_MOCKS) return');
    expect(client).toContain('useOfflineStorage(`${tenantId}:${locationId}`)');
    expect(client).not.toContain('useState<Order[]>(mockOrders)');
    expect(offline).toContain('mise_kds_orders:${scope}');
    expect(offline).toContain('mise_kds_completed:${scope}');
  });

  it.each([
    ['alert rules', alertRulesRoute],
    ['alerts', alertsRoute],
    ['driver performance', performanceRoute],
    ['push statistics', pushStatsRoute],
  ])('binds %s service queries to an authorized tenant location', (_name, route) => {
    expect(route).toContain('getDeliveryAdminActor()');
    expect(route).toContain('isDeliveryAdminLocation(actor,');
  });

  it('authorizes alert ids through their owning location before mutation', () => {
    expect(alertRoute).toContain(".select('location_id')");
    expect(alertRoute).toContain('isDeliveryAdminLocation(actor, alert.location_id as string)');
    expect(alertRoute).toContain(".eq('location_id', alert.location_id as string)");
  });

  it('keeps anonymous health checks minimal and tenant-scopes detailed checks', () => {
    expect(healthRoute).toContain('if (!locationId)');
    expect(healthRoute).toContain('getDeliveryAdminActor()');
    expect(healthRoute).toContain('isDeliveryAdminLocation(actor, locationId)');
    expect(healthRoute).toContain("from('mise_driver_tenants')");
    expect(pushStatsRoute).toContain(".eq('tenant_id', actor.tenant_id as string)");
  });

  it.each(hardenedAdminLocationRoutes)('requires tenant-owned locations in %s', (_path, route) => {
    expect(route).toContain('getDeliveryAdminActor()');
    expect(route).toContain('isDeliveryAdminLocation(actor,');
  });

  it('scopes driver, payout, schedule, satisfaction and push subresources', () => {
    const drivers = source('app/api/delivery/admin/drivers/route.ts');
    const payouts = source('app/api/delivery/admin/payouts/route.ts');
    const scheduled = source('lib/delivery/scheduled.ts');
    const proof = source('lib/delivery/proof.ts');
    const satisfaction = source('lib/delivery/satisfaction.ts');

    expect(drivers).toContain("from('mise_driver_tenants')");
    expect(drivers).toContain(".eq('tenant_id', actor.tenant_id as string)");
    expect(payouts).toContain('areAuthorizedPayoutPeriods(actor,');
    expect(scheduled).toContain("dueQuery = dueQuery.eq('location_id', locationId)");
    expect(proof).toContain("attemptsQuery = attemptsQuery.eq('location_id', locationId)");
    expect(satisfaction).toContain(".in('driver_id', locationDriverIds)");
    expect(pushStatsRoute).toContain(".in('driver_id', driverIds)");
    expect(pushStatsRoute).toContain(".in('employee_id', employeeIds)");
  });
});
