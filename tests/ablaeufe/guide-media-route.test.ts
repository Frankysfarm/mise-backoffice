// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq']) chain[method] = vi.fn(() => chain);
  chain.maybeSingle = maybeSingle;
  const upload = vi.fn();
  const remove = vi.fn();
  return {
    actor: vi.fn(),
    maybeSingle,
    upload,
    remove,
    createServiceClient: vi.fn(() => ({
      from: vi.fn(() => chain),
      storage: { from: vi.fn(() => ({ upload, remove })) },
    })),
  };
});

vi.mock('@/lib/auth/getCurrentEmployee', () => ({ getCurrentEmployee: mocks.actor }));
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: mocks.createServiceClient }));

import { DELETE, POST } from '@/app/api/ablaeufe/guides/[id]/media/route';

const GUIDE_ID = '11111111-2222-4333-8444-555555555555';
const manager = { id: 'emp-1', rolle: 'manager', tenant_id: 'tenant-1', location_id: 'loc-1' };
const params = Promise.resolve({ id: GUIDE_ID });

function uploadRequest(file: File | null): Request {
  const form = new FormData();
  if (file) form.set('file', file);
  return new Request('http://test/api', { method: 'POST', body: form });
}

describe('Anleitungs-Medien-Upload für Listen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.actor.mockResolvedValue(manager);
    mocks.maybeSingle.mockResolvedValue({ data: { id: GUIDE_ID, tenant_id: 'tenant-1', location_id: 'loc-1' } });
    mocks.upload.mockResolvedValue({ error: null });
    mocks.remove.mockResolvedValue({ error: null });
  });

  it('verlangt Anmeldung und Leitungsrolle', async () => {
    mocks.actor.mockResolvedValue(null);
    expect((await POST(uploadRequest(new File(['x'], 'a.jpg', { type: 'image/jpeg' })), { params }))?.status).toBe(401);
    mocks.actor.mockResolvedValue({ ...manager, rolle: 'mitarbeiter' });
    expect((await POST(uploadRequest(new File(['x'], 'a.jpg', { type: 'image/jpeg' })), { params }))?.status).toBe(403);
  });

  it('lehnt fremde Listen und falsche Dateitypen ab', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null });
    expect((await POST(uploadRequest(new File(['x'], 'a.jpg', { type: 'image/jpeg' })), { params }))?.status).toBe(404);
    mocks.maybeSingle.mockResolvedValue({ data: { id: GUIDE_ID, tenant_id: 'tenant-1', location_id: 'loc-2' } });
    expect((await POST(uploadRequest(new File(['x'], 'a.jpg', { type: 'image/jpeg' })), { params }))?.status).toBe(403);
    mocks.maybeSingle.mockResolvedValue({ data: { id: GUIDE_ID, tenant_id: 'tenant-1', location_id: 'loc-1' } });
    expect((await POST(uploadRequest(new File(['x'], 'a.gif', { type: 'image/gif' })), { params }))?.status).toBe(400);
    expect((await POST(uploadRequest(null), { params }))?.status).toBe(400);
  });

  it('speichert ein Bild unter dem Mandanten-Pfad und meldet Art + Pfad', async () => {
    const response = await POST(uploadRequest(new File(['x'], 'a.jpg', { type: 'image/jpeg' })), { params });
    expect(response?.status).toBe(201);
    const body = await response!.json();
    expect(body.media.kind).toBe('image');
    expect(body.media.path).toMatch(new RegExp(`^tenant-1/guides/${GUIDE_ID}/[0-9a-f-]{36}\\.jpg$`));
    expect(mocks.upload).toHaveBeenCalledWith(body.media.path, expect.anything(), expect.objectContaining({ contentType: 'image/jpeg', upsert: false }));
  });

  it('erkennt Videos und meldet kind=video', async () => {
    const response = await POST(uploadRequest(new File(['x'], 'a.mp4', { type: 'video/mp4' })), { params });
    expect(response?.status).toBe(201);
    expect((await response!.json()).media.kind).toBe('video');
  });

  it('löscht nur Pfade unterhalb der eigenen Liste', async () => {
    const good = new Request('http://test/api', { method: 'DELETE', body: JSON.stringify({ path: `tenant-1/guides/${GUIDE_ID}/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg` }) });
    expect((await DELETE(good, { params }))?.status).toBe(200);
    expect(mocks.remove).toHaveBeenCalledTimes(1);
    const foreign = new Request('http://test/api', { method: 'DELETE', body: JSON.stringify({ path: 'tenant-2/guides/x/../../geheim.pdf' }) });
    expect((await DELETE(foreign, { params }))?.status).toBe(400);
    expect(mocks.remove).toHaveBeenCalledTimes(1);
  });
});
