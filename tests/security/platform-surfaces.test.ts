import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GET as retiredDriverGet, POST as retiredDriverPost } from '@/app/api/driver-app/[...legacy]/route';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('retired and protected platform surfaces', () => {
  it('returns 410 for every legacy driver API access instead of trusting a driver id', async () => {
    const getResponse = await retiredDriverGet();
    const postResponse = await retiredDriverPost();
    expect(getResponse.status).toBe(410);
    expect(postResponse.status).toBe(410);
    await expect(getResponse.json()).resolves.toMatchObject({ code: 'driver_api_retired' });
  });

  it('does not ship the old driver-id based mutation handlers', () => {
    const middleware = source('lib/supabase/middleware.ts');
    const retired = source('app/api/driver-app/[...legacy]/route.ts');
    expect(retired).not.toContain('driverId');
    expect(retired).not.toContain('createServiceClient');
    expect(middleware).toContain("pathname.startsWith('/api/driver-app/')");
  });

  it('requires authenticated POS access and contains no pilot tenant fallback', () => {
    const layout = source('app/(admin)/layout.tsx');
    const pos = source('app/(admin)/pos/terminal-v5/page.tsx');
    expect(layout).not.toContain('DEV_PUBLIC_PATHS');
    expect(pos).toContain('requirePosAccess()');
    expect(pos).not.toContain('DEV_TENANT_ID');
    expect(pos).not.toContain('DEV_LOCATION_ID');
  });

  it('gives employees a protected team portal and tenant-scopes invitations', () => {
    const middleware = source('lib/supabase/middleware.ts');
    const invite = source('app/api/employees/invite/route.ts');
    const portal = source('app/mitarbeiter/page.tsx');
    expect(middleware).toContain("pathname === '/mitarbeiter'");
    expect(middleware).toContain('isEmployeeArea');
    expect(invite).toContain(".eq('tenant_id', actor.tenant_id)");
    expect(invite).toContain('next=/mitarbeiter');
    expect(portal).toContain(".eq('employee_id', employee.id)");
    expect(portal).toContain(".eq('tenant_id', employee.tenant_id)");
  });

  it('keeps owner push isolated from the driver service worker scope', () => {
    const setup = source('app/(neo)/neo/app/pwa-setup.tsx');
    const ownerWorker = source('public/sw-owner.js');
    const middleware = source('lib/supabase/middleware.ts');
    expect(setup).toContain("register('/sw-owner.js', { scope: '/neo/' })");
    expect(setup).not.toContain("register('/sw.js')");
    expect(middleware).toContain("pathname === '/sw-owner.js'");
    expect(ownerWorker).toContain("self.addEventListener('push'");
    expect(ownerWorker).toContain('self.registration.showNotification');
    expect(ownerWorker).toContain("data.url || '/neo/app/uebersicht'");
  });

  it('uses prefix matching for module gates and leaves no hard-coded pilot server links', () => {
    const modules = source('lib/modules.ts');
    const allAppSource = [
      source('app/(neo)/neo/app/tischbestellung/page.tsx'),
      source('app/(neo)/neo/app/tischbestellung/client.tsx'),
    ].join('\n');
    expect(modules).toContain('const moduleId = matchRouteToModule(href)');
    expect(allAppSource).not.toContain('178.104.106.72');
  });

  it('binds costly brand generation to the current manager tenant', () => {
    const route = source('app/api/brand-images/generate/route.ts');
    expect(route).toContain('requireManagerPlus()');
    expect(route).toContain('tenant_id !== employee.tenant_id');
    expect(route.indexOf('requireManagerPlus()')).toBeLessThan(route.indexOf("fetch('https://api.openai.com"));
  });

  it('does not expose order status through an order id or wildcard CORS alone', () => {
    const route = source('app/api/order/status/route.ts');
    expect(route).toContain("searchParams.get('token')");
    expect(route).toContain(".eq('tracking_token', token)");
    expect(route).not.toContain("'Access-Control-Allow-Origin': '*'");
  });

  it('ownership-checks every driver-controlled batch mutation', () => {
    const reroute = source('app/api/driver/v1/batch/[id]/reroute/route.ts');
    const arrived = source('app/api/driver/v1/batch/[id]/stops/[stopId]/arrived/route.ts');
    const issue = source('app/api/driver/v1/orders/[id]/issue/route.ts');
    const pickVerify = source('app/api/driver/v1/orders/[id]/pick-verify/route.ts');
    expect(reroute).toContain(".eq('driver_id', member.driver.id)");
    expect(arrived).toContain(".eq('driver_id', m.driver.id)");
    expect(issue).toContain(".eq('mise_delivery_batches.driver_id', m.driver.id)");
    expect(pickVerify).toContain(".eq('mise_delivery_batches.driver_id', m.driver.id)");
  });

  it('retires the client-priced cash endpoint and prices checkout items from the database', () => {
    const cash = source('app/api/order/cash/route.ts');
    const checkout = source('app/api/order/checkout/route.ts');
    expect(cash).toContain('status: 410');
    expect(checkout).not.toContain('normalizeFallbackItems');
    expect(checkout).toContain(".eq('location_id', table.location_id).eq('verfuegbar', true)");
  });

  it('serves table QR orders locally and resolves their price on the server', () => {
    const page = source('app/t/[token]/page.tsx');
    const storefront = source('app/t/[token]/storefront.tsx');
    const route = source('app/api/order/table/route.ts');
    expect(page).not.toContain('/tisch/t/');
    expect(page).toContain(".eq('qr_token', token)");
    expect(storefront).toContain("fetch('/api/order/table'");
    expect(storefront).not.toContain("from('customer_orders').insert");
    expect(route).toContain('getValidTableSession(req, tableId)');
    expect(route).toContain(".eq('tenant_id', session.tenant_id)");
    expect(route).toContain(".eq('qr_version', session.qr_version)");
    expect(route).toContain('resolveTableOrderItem');
    expect(route).not.toContain('body.total');
  });

  it('requires manager-level access for all driver admin routes', () => {
    const adminContext = source('app/api/admin/_lib/tenant-from-session.ts');
    expect(adminContext).toContain("['manager', 'backoffice', 'admin'].includes");
    expect(adminContext).toContain(".in('status', ['aktiv', 'in_training', 'in_probe'])");
  });

  it('protects delivery-window reads and mutations with the order tracking capability', () => {
    const route = source('app/api/delivery/windows/route.ts');
    expect(route.match(/hasTrackingAccess\(req, order/g)).toHaveLength(3);
  });
});
