import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const source = (rel: string) => readFileSync(join(root, rel), 'utf8');

// P0-1 / P1-4 aus docs/RELEASE-COMPLETION-PLAN-DRIVER-V1.md:
// Der Delivered-Pfad darf Lieferungen weder still korrumpieren noch
// offline fälschlich als abgeschlossen melden.
describe('delivered path safety', () => {
  it('delivered route is idempotent and keeps driver state consistent', () => {
    const route = source('app/api/driver/v1/orders/[id]/delivered/route.ts');
    // Doppel-Tap/Outbox-Retry: bereits gelieferte Order ist Erfolg-No-op, kein Überschreiben
    expect(route).toContain("paidOrd.status === 'geliefert'");
    expect(route).toContain('already_delivered');
    // Nach Batch-Abschluss: Fahrer nicht in en_route hängen lassen
    expect(route).toContain("update({ state: 'returning' })");
  });

  it('stop lookup survives requeued orders (no bare maybeSingle on order_id)', () => {
    for (const rel of [
      'app/api/driver/v1/orders/[id]/delivered/route.ts',
      'app/api/driver/v1/orders/[id]/picked-up/route.ts',
    ]) {
      const route = source(rel);
      // Stop-Lookup muss auf nicht-stornierte Stops im aktiven Batch des Fahrers filtern
      expect(route).toContain("eq('cancelled', false)");
      expect(route).toContain("mise_delivery_batches!inner");
      expect(route).toContain("eq('mise_delivery_batches.driver_id', m.driver.id)");
    }
  });

  it('markDelivered has no silent direct-write fallback on API errors', () => {
    const view = source('app/fahrer/app/delivery-view.tsx');
    const fn = view.slice(view.indexOf('async function markDelivered'), view.indexOf('async function markFailedAttempt'));
    // Kein Direct-Write auf customer_orders mehr im Fehlerpfad
    expect(fn).not.toContain("from('customer_orders')");
    // API-Fehler: Optimistic-Update zurücknehmen + sichtbare Meldung
    expect(fn).toContain('geliefert_am: null');
    expect(fn).toContain('NICHT gespeichert');
    // 409 order_not_picked_up: Recovery über picked-up + genau 1 Retry
    expect(fn).toContain('order_not_picked_up');
    expect(fn).toContain('/picked-up');
  });

  it('offline delivered does not finish the tour before server confirmation', () => {
    const view = source('app/fahrer/app/delivery-view.tsx');
    const fn = view.slice(view.indexOf('async function markDelivered'), view.indexOf('async function markFailedAttempt'));
    const offlineBranch = fn.slice(fn.indexOf('if (!isOnline)'), fn.indexOf('try {'));
    expect(offlineBranch).toContain('enqueueOutbox');
    expect(offlineBranch).toContain('setSyncNotice');
    expect(offlineBranch).not.toContain('onAllDone');
    // Nach erfolgreichem Outbox-Flush wird die Tour regulär abgeschlossen
    expect(view).toContain('flushOutbox(getToken)');
    expect(view).toContain('stopsRef.current.every');
  });

  it('tour close button surfaces failures instead of swallowing them', () => {
    const view = source('app/fahrer/app/delivery-view.tsx');
    const fn = view.slice(view.indexOf('function TourCloseButton'));
    expect(fn).toContain('miseError');
    expect(fn).toContain('NICHT abgeschlossen');
  });
});

// P0-2: Storno während aktiver Tour muss den Fahrer erreichen.
describe('cancelled stops reach the driver (P0-2)', () => {
  it('cancelled stops never block tour completion', () => {
    const route = source('app/api/driver/v1/orders/[id]/delivered/route.ts');
    const completion = route.slice(route.indexOf('openStops'));
    expect(completion).toContain("eq('cancelled', false)");
    const engine = source('lib/delivery/dispatch-engine.ts');
    const fn = engine.slice(engine.indexOf('async function reconcileCompletedBatches'));
    expect(fn).toContain('filter((s) => !s.cancelled)');
  });

  it('server load never renders cancelled stops', () => {
    const page = source('app/fahrer/app/page.tsx');
    expect(page).toContain('completed_at, type, cancelled,');
    expect(page.match(/type === 'dropoff' && !s\.cancelled/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('DeliveryView syncs server props into local stops state', () => {
    const view = source('app/fahrer/app/delivery-view.tsx');
    expect(view).toContain('}, [initialStops]);');
    expect(view).toContain('initialStops.map((n)');
  });

  it('active tour has a polling fallback for dead realtime', () => {
    const client = source('app/fahrer/app/client.tsx');
    expect(client).toContain("setInterval(() => router.refresh(), 30_000)");
    expect(client).toContain('}, [activeBatch?.id]);');
  });
});

// P1-1: Realtime muss Fehler erkennen und neu verbinden.
describe('realtime hardening (P1-1)', () => {
  it('main channel evaluates subscribe status and reconnects with backoff', () => {
    const client = source('app/fahrer/app/client.tsx');
    expect(client).toContain("subscribe((status)");
    expect(client).toContain("'CHANNEL_ERROR'");
    expect(client).toContain("'TIMED_OUT'");
    expect(client).toContain('setTimeout(connect, delayMs)');
    expect(client).toContain('Math.min(30_000');
  });
});

// P1-2: Session-Ablauf darf den Fahrer nicht still aus dem Pool werfen.
describe('auth expiry surfacing (P1-2)', () => {
  it('GPS push checks 401, refreshes session, and warns loudly on failure', () => {
    const client = source('app/fahrer/app/client.tsx');
    expect(client).toContain('res.status === 401');
    expect(client).toContain('supabase.auth.refreshSession()');
    expect(client).toContain('setAuthLost(true)');
    // Token wird auch INVALIDIERT, nicht nur gesetzt
    expect(client).toContain("accessTokenRef.current = session?.access_token ?? ''");
    // Sichtbare Warnung mit Weg zurück zum Login
    expect(client).toContain('Anmeldung abgelaufen');
    expect(client).toContain('/fahrer/login');
  });
});

// P1-3: GPS-Ausfall muss dem Fahrer sichtbar gemeldet werden.
describe('gps failure surfacing (P1-3)', () => {
  it('geolocation errors propagate and render a visible warning', () => {
    const bg = source('app/fahrer/app/bg-location.ts');
    expect(bg).toContain('export function onGpsError');
    expect(bg).toContain('_onGpsError?.(err?.code');
    const client = source('app/fahrer/app/client.tsx');
    expect(client).toContain('onGpsError((code)');
    expect(client).toContain('GPS blockiert');
    expect(client).toContain('GPS-Signal veraltet');
    expect(client).toContain('nowTick - gpsLastAt > 120_000');
  });
});
