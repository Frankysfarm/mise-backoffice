import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const source = (rel: string) => readFileSync(join(root, rel), 'utf8');

describe('driver client robustness', () => {
  it('refreshes native GPS authority after online state changes', () => {
    const client = source('app/fahrer/app/client.tsx');
    expect(client).toContain("window.location.href = 'mise-driver://gps-refresh'");
    expect(client.match(/refreshNativeGpsAuthority\(\)/g)?.length).toBeGreaterThanOrEqual(3);
    const register = source('app/fahrer/app/push-register.tsx');
    expect(register).toContain("window.location.href = 'mise-driver://gps-refresh'");
  });
  it('consumes native push offers through an authoritative server refresh and ACK', () => {
    const client = source('app/fahrer/app/client.tsx');
    expect(client).toContain("addEventListener('mise-driver-offer'");
    expect(client).toContain("window.location.href = 'mise-driver://bridge-ready'");
    expect(client).toContain('router.refresh();');
    expect(client).toContain('bridge?.ack?.(detail)');
  });
  it('sends GPS fixes with a cached access token instead of per-fix getSession', () => {
    const client = source('app/fahrer/app/client.tsx');
    expect(client).toContain('accessTokenRef');
    expect(client).toContain('onAuthStateChange');
    const pushFnBlock = client.slice(
      client.indexOf('const pushFn = async'),
      client.indexOf('startBgLocation(pushFn'),
    );
    expect(pushFnBlock).not.toContain('supabase.auth.getSession()');
    expect(pushFnBlock).toContain('accessTokenRef.current');
  });

  it('surfaces confirm_pickup_complete failures to the driver', () => {
    const client = source('app/fahrer/app/client.tsx');
    const block = client.slice(
      client.indexOf('async function completeAndRoute'),
      client.indexOf('async function markDelivered'),
    );
    expect(block).toContain('r.ok === false');
    expect(block).toContain('alert(');
  });

  it('translates the PICK_REQUIRED trigger error into driver language', () => {
    const client = source('app/fahrer/app/client.tsx');
    const block = client.slice(
      client.indexOf('async function completeAndRoute'),
      client.indexOf('async function markDelivered'),
    );
    expect(block).toContain('PICK_REQUIRED');
    expect(block).toContain('Artikel');
  });
});

describe('pick auto-flow', () => {
  // Ab 14.08.: der Dialog bekommt die GANZE Tour und blättert selbst weiter
  // (Wisch-Strecke statt Neu-Montage pro Bestellung). Das Weiterschalten liegt
  // jetzt in pick-dialog.tsx, der Abschluss weiterhin beim Aufrufer.
  it('hands the whole tour to the dialog and routes from its last page', () => {
    const client = readFileSync(join(root, 'app/fahrer/app/client.tsx'), 'utf8');
    const block = client.slice(
      client.indexOf('{pickOpen && activeBatch'),
      client.indexOf('{/* F1: Route'),
    );
    expect(block).toContain('orders={pickOrders}');
    expect(block).toContain('completeAndRoute(');
    const dialog = readFileSync(join(root, 'app/fahrer/app/pick-dialog.tsx'), 'utf8');
    expect(dialog).toContain('autoAdvanced');
  });

  it('skips the route sheet interstitial after pickup', () => {
    const client = readFileSync(join(root, 'app/fahrer/app/client.tsx'), 'utf8');
    const block = client.slice(
      client.indexOf('async function completeAndRoute'),
      client.indexOf('async function markDelivered'),
    );
    expect(block).not.toContain('showRouteSheetAfterPickup');
  });
});
