import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const deleteQuery = vi.fn();
  const from = vi.fn(() => {
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'in', 'is', 'not', 'gte', 'lte', 'order', 'limit']) {
      chain[method] = vi.fn(() => chain);
    }
    chain.maybeSingle = vi.fn(async () => ({ data: { location_id: 'foreign-location' }, error: null }));
    chain.delete = deleteQuery.mockImplementation(() => chain);
    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null, count: 0 }).then(resolve);
    return chain;
  });

  return {
    actor: vi.fn(),
    locationAllowed: vi.fn(),
    createServiceClient: vi.fn(() => ({ from })),
    from,
    deleteQuery,
    getActiveAlerts: vi.fn(),
    getAlertHistory: vi.fn(),
    evaluateAlerts: vi.fn(),
    resolveAlert: vi.fn(),
    getAlertRules: vi.fn(),
    upsertAlertRule: vi.fn(),
    coverage: vi.fn(),
    getScheduledQueue: vi.fn(),
    getScheduledSummary: vi.fn(),
    manuallyReleaseOrder: vi.fn(),
    releaseScheduledOrders: vi.fn(),
    generateOrdersCSV: vi.fn(),
    generateDriversCSV: vi.fn(),
    listWebhooks: vi.fn(),
    registerWebhook: vi.fn(),
  };
});

vi.mock('@/lib/delivery/admin-auth', () => ({
  getDeliveryAdminActor: mocks.actor,
  isDeliveryAdminLocation: mocks.locationAllowed,
}));

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock('@/lib/delivery/alerts', () => ({
  getActiveAlerts: mocks.getActiveAlerts,
  getAlertHistory: mocks.getAlertHistory,
  evaluateAlerts: mocks.evaluateAlerts,
  resolveAlert: mocks.resolveAlert,
  getAlertRules: mocks.getAlertRules,
  upsertAlertRule: mocks.upsertAlertRule,
}));

vi.mock('@/lib/delivery/shifts', () => ({
  getCurrentCoverageStatus: mocks.coverage,
}));

vi.mock('@/lib/delivery/scheduled', () => ({
  getScheduledQueue: mocks.getScheduledQueue,
  getScheduledSummary: mocks.getScheduledSummary,
  manuallyReleaseOrder: mocks.manuallyReleaseOrder,
  releaseScheduledOrders: mocks.releaseScheduledOrders,
}));

vi.mock('@/lib/delivery/reporting', () => ({
  generateOrdersCSV: mocks.generateOrdersCSV,
  generateDriversCSV: mocks.generateDriversCSV,
}));

vi.mock('@/lib/delivery/webhooks', () => ({
  listWebhooks: mocks.listWebhooks,
  registerWebhook: mocks.registerWebhook,
}));

import { GET as getAlerts, POST as postAlerts } from '@/app/api/delivery/admin/alerts/route';
import { PATCH as patchAlert, DELETE as deleteAlert } from '@/app/api/delivery/admin/alerts/[id]/route';
import { GET as getPerformance } from '@/app/api/delivery/admin/performance/route';
import { GET as getPushStats } from '@/app/api/delivery/admin/push-stats/route';
import { GET as getHealth } from '@/app/api/delivery/health/route';
import { POST as postScheduled } from '@/app/api/delivery/admin/scheduled/route';
import { GET as exportReporting } from '@/app/api/delivery/admin/reporting/export/route';
import { POST as postWebhook } from '@/app/api/delivery/admin/webhooks/route';

const actor = {
  id: 'employee-1',
  auth_user_id: 'auth-user-1',
  tenant_id: 'tenant-1',
  location_id: 'location-1',
  rolle: 'admin',
};

describe('delivery admin runtime tenant boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.actor.mockResolvedValue(actor);
    mocks.locationAllowed.mockResolvedValue(false);
    mocks.coverage.mockResolvedValue({ uncovered_slots: 0, understaffed_slots: 0 });
  });

  it('rejects cross-tenant alert reads before calling the service-backed alert engine', async () => {
    const response = await getAlerts(new Request(
      'http://localhost/api/delivery/admin/alerts?location_id=foreign-location',
    ) as never);

    expect(response.status).toBe(403);
    expect(mocks.getActiveAlerts).not.toHaveBeenCalled();
    expect(mocks.getAlertHistory).not.toHaveBeenCalled();
  });

  it('rejects cross-tenant alert evaluation and bulk resolution', async () => {
    const response = await postAlerts(new Request(
      'http://localhost/api/delivery/admin/alerts',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ location_id: 'foreign-location', action: 'evaluate' }),
      },
    ) as never);

    expect(response.status).toBe(403);
    expect(mocks.evaluateAlerts).not.toHaveBeenCalled();
    expect(mocks.resolveAlert).not.toHaveBeenCalled();
  });

  it('rejects resolving or deleting an alert owned by another tenant', async () => {
    const params = { params: Promise.resolve({ id: 'alert-1' }) };
    const patchResponse = await patchAlert(new Request(
      'http://localhost/api/delivery/admin/alerts/alert-1',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'resolve' }),
      },
    ) as never, params);
    const deleteResponse = await deleteAlert(new Request(
      'http://localhost/api/delivery/admin/alerts/alert-1',
      { method: 'DELETE' },
    ) as never, params);

    expect(patchResponse.status).toBe(403);
    expect(deleteResponse.status).toBe(403);
    expect(mocks.resolveAlert).not.toHaveBeenCalled();
    expect(mocks.deleteQuery).not.toHaveBeenCalled();
  });

  it('rejects cross-tenant driver performance and push statistics', async () => {
    const performanceResponse = await getPerformance(new Request(
      'http://localhost/api/delivery/admin/performance?location_id=foreign-location',
    ) as never);
    const pushResponse = await getPushStats(new Request(
      'http://localhost/api/delivery/admin/push-stats?location_id=foreign-location',
    ) as never);

    expect(performanceResponse.status).toBe(403);
    expect(pushResponse.status).toBe(403);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it('keeps the public health response limited to database reachability', async () => {
    const response = await getHealth(new Request(
      'http://localhost/api/delivery/health',
    ) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(body.checks)).toEqual(['database']);
    expect(mocks.actor).not.toHaveBeenCalled();
  });

  it('rejects anonymous or cross-tenant location health details', async () => {
    mocks.actor.mockResolvedValueOnce(null);
    const anonymous = await getHealth(new Request(
      'http://localhost/api/delivery/health?location_id=foreign-location',
    ) as never);

    mocks.actor.mockResolvedValueOnce(actor);
    const foreign = await getHealth(new Request(
      'http://localhost/api/delivery/health?location_id=foreign-location',
    ) as never);

    expect(anonymous.status).toBe(403);
    expect(foreign.status).toBe(403);
    expect(mocks.coverage).not.toHaveBeenCalled();
  });

  it('blocks cross-tenant release-all, reporting exports and webhook creation', async () => {
    const scheduled = await postScheduled(new Request(
      'http://localhost/api/delivery/admin/scheduled',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'release_all', location_id: 'foreign-location' }),
      },
    ) as never);
    const reporting = await exportReporting(new Request(
      'http://localhost/api/delivery/admin/reporting/export?format=orders&location_id=foreign-location',
    ) as never);
    const webhook = await postWebhook(new Request(
      'http://localhost/api/delivery/admin/webhooks',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          location_id: 'foreign-location',
          url: 'https://example.invalid/hook',
          secret: 'not-a-real-secret',
          events: ['delivered'],
        }),
      },
    ) as never);

    expect(scheduled.status).toBe(403);
    expect(reporting.status).toBe(403);
    expect(webhook.status).toBe(403);
    expect(mocks.releaseScheduledOrders).not.toHaveBeenCalled();
    expect(mocks.generateOrdersCSV).not.toHaveBeenCalled();
    expect(mocks.registerWebhook).not.toHaveBeenCalled();
  });
});
