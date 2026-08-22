import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const rpc = vi.fn();
  const maybeSingle = vi.fn();
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in']) chain[method] = vi.fn(() => chain);
  chain.maybeSingle = maybeSingle;
  const client = { rpc, from: vi.fn(() => chain) };
  return {
    member: vi.fn(),
    unauthorized: vi.fn(() => new Response(JSON.stringify({ code: 'unauthorized' }), { status: 401 })),
    sb: vi.fn(() => client),
    rpc,
    maybeSingle,
    rerouteBundle: vi.fn(),
    markPickedUp: vi.fn(),
    promoteNextScheduled: vi.fn(),
  };
});

vi.mock('@/app/api/driver/v1/_lib/driver-auth', () => ({
  getDriverFromBearer: mocks.member,
  unauthorized: mocks.unauthorized,
  sb: mocks.sb,
  badRequest: (message: string) => Response.json({ error: message }, { status: 400 }),
}));

vi.mock('@/lib/frank', () => ({ rerouteBundle: mocks.rerouteBundle }));
vi.mock('@/lib/delivery/kitchen-sync', () => ({
  markPickedUp: mocks.markPickedUp,
  promoteNextScheduled: mocks.promoteNextScheduled,
}));

import { POST as pickedUp } from '@/app/api/driver/v1/orders/[id]/picked-up/route';
import { POST as delivered } from '@/app/api/driver/v1/orders/[id]/delivered/route';
import { POST as reroute } from '@/app/api/driver/v1/batch/[id]/reroute/route';

const member = { driver: { id: 'driver-1' }, token: 'token' };
const params = (id = 'order-1') => ({ params: Promise.resolve({ id }) });

describe('driver transition routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.member.mockResolvedValue(member);
    mocks.rerouteBundle.mockResolvedValue(undefined);
    mocks.maybeSingle.mockResolvedValue({ data: { id: 'batch-1' }, error: null });
  });

  it('rejects an unauthenticated delivery before calling the database', async () => {
    mocks.member.mockResolvedValueOnce(null);
    const response = await delivered(new Request('http://localhost', { method: 'POST' }) as never, params());
    expect(response.status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('sends delivery proof and authenticated driver identity to the atomic RPC', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { ok: true, already_delivered: true, batch_completed: true, batch_id: 'batch-1' },
      error: null,
    });
    const response = await delivered(new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ photo_url: 'https://example.invalid/proof.jpg', signature: 'signed' }),
    }) as never, params());
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('complete_driver_delivery', {
      p_order_id: 'order-1',
      p_driver_id: 'driver-1',
      p_delivery_proof: { photo_url: 'https://example.invalid/proof.jpg', signature: 'signed' },
    });
  });

  it('preserves the status-machine conflict code for a premature delivery', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { ok: false, code: 'order_not_picked_up', error: 'noch nicht abgeholt' },
      error: null,
    });
    const response = await delivered(new Request('http://localhost', { method: 'POST' }) as never, params());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'order_not_picked_up' });
  });

  it('reroutes only after the atomic pickup has committed', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { ok: true, batch_id: 'batch-1', should_reroute: true },
      error: null,
    });
    const response = await pickedUp(new Request('http://localhost', { method: 'POST' }) as never, params());
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('complete_driver_pickup', {
      p_order_id: 'order-1', p_driver_id: 'driver-1',
    });
    expect(mocks.rerouteBundle).toHaveBeenCalledWith('batch-1');
  });

  it('keeps internal-fleet pickup behind the QR handoff', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { ok: false, code: 'qr_handoff_required', error: 'QR erforderlich' },
      error: null,
    });
    const response = await pickedUp(new Request('http://localhost', { method: 'POST' }) as never, params());
    expect(response.status).toBe(409);
    expect(mocks.rerouteBundle).not.toHaveBeenCalled();
  });

  it('does not reroute a batch that is not owned by the authenticated driver', async () => {
    mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const response = await reroute(new Request('http://localhost', { method: 'POST' }) as never, params('batch-foreign'));
    expect(response.status).toBe(403);
    expect(mocks.rerouteBundle).not.toHaveBeenCalled();
  });
});
