import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const single = vi.fn();
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq']) chain[method] = vi.fn(() => chain);
  chain.single = single;
  return {
    actor: vi.fn(),
    locationAllowed: vi.fn(),
    smartDispatchTick: vi.fn(),
    dispatchSingleOrder: vi.fn(),
    createServiceClient: vi.fn(() => ({ from: vi.fn(() => chain) })),
    single,
  };
});

vi.mock('@/lib/delivery/admin-auth', () => ({
  getDeliveryAdminActor: mocks.actor,
  isDeliveryAdminLocation: mocks.locationAllowed,
}));

vi.mock('@/lib/delivery/dispatch-engine', () => ({
  smartDispatchTick: mocks.smartDispatchTick,
  dispatchSingleOrder: mocks.dispatchSingleOrder,
}));

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: mocks.createServiceClient,
}));

import { POST } from '@/app/api/delivery/dispatch/route';

const actor = {
  id: 'employee-1',
  auth_user_id: 'auth-1',
  vorname: 'Ada',
  nachname: 'Admin',
  email: 'ada@example.invalid',
  rolle: 'admin',
  department_id: null,
  tenant_id: 'tenant-1',
  location_id: 'location-1',
};

describe('manual dispatch authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.BISS_INTERNAL_TOKEN;
    mocks.actor.mockResolvedValue(actor);
    mocks.locationAllowed.mockResolvedValue(true);
    mocks.smartDispatchTick.mockResolvedValue({ scanned: 0, dispatched: 0, bundled: 0, held: 0, escalated: 0, results: [] });
    mocks.dispatchSingleOrder.mockResolvedValue({ outcome: 'held' });
    mocks.single.mockResolvedValue({
      data: {
        id: 'order-1', location_id: 'location-1', dispatch_attempts: 0,
        kunde_lat: 50, kunde_lng: 6, kunde_adresse: null, kunde_plz: null,
        kunde_stadt: null, bestellnummer: 'T-1', priority: null,
        estimated_prep_min: 15, created_at: new Date().toISOString(), dispatch_escalated_at: null,
      },
      error: null,
    });
  });

  it('rejects anonymous users before dispatch work starts', async () => {
    mocks.actor.mockResolvedValueOnce(null);
    const response = await POST(new Request('http://localhost/api/delivery/dispatch', { method: 'POST' }) as never);
    expect(response.status).toBe(403);
    expect(mocks.smartDispatchTick).not.toHaveBeenCalled();
  });

  it('limits an interactive tick to an authorized employee location', async () => {
    const response = await POST(new Request('http://localhost/api/delivery/dispatch', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    }) as never);
    expect(response.status).toBe(200);
    expect(mocks.locationAllowed).toHaveBeenCalledWith(actor, 'location-1');
    expect(mocks.smartDispatchTick).toHaveBeenCalledWith({ locationId: 'location-1', runGlobalMaintenance: false });
  });

  it('does not dispatch a foreign order', async () => {
    mocks.locationAllowed.mockResolvedValueOnce(false);
    const response = await POST(new Request('http://localhost/api/delivery/dispatch', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ order_id: 'order-1' }),
    }) as never);
    expect(response.status).toBe(404);
    expect(mocks.dispatchSingleOrder).not.toHaveBeenCalled();
  });

  it('allows the internal cron token to run the global maintenance tick', async () => {
    process.env.BISS_INTERNAL_TOKEN = 'dispatch-internal-token-123';
    const response = await POST(new Request('http://localhost/api/delivery/dispatch', {
      method: 'POST', headers: { 'x-internal-token': process.env.BISS_INTERNAL_TOKEN },
    }) as never);
    expect(response.status).toBe(200);
    expect(mocks.actor).not.toHaveBeenCalled();
    expect(mocks.smartDispatchTick).toHaveBeenCalledWith({ runGlobalMaintenance: true });
  });
});
