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
