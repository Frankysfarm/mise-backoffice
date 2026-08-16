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

// P1-6: Build-Gates — leerer Build-Arg oder Typfehler im Delivery-Pfad muss den Build stoppen.
describe('build gates (P1-6)', () => {
  it('Dockerfile guards empty build args and runs the delivery typecheck', () => {
    const docker = source('Dockerfile');
    expect(docker).toContain('test -n "$NEXT_PUBLIC_SUPABASE_URL"');
    expect(docker).toContain('test -n "$NEXT_PUBLIC_VAPID_PUBLIC_KEY"');
    expect(docker).toContain('pnpm typecheck:delivery');
    const pkg = source('package.json');
    expect(pkg).toContain('"typecheck:delivery"');
  });
});

// P1-7: kein ungeschützter Debug-Endpoint im Fahrer-Namespace.
describe('no unauthenticated debug endpoint (P1-7)', () => {
  it('push-debug route is gone and internal endpoints are token-gated', () => {
    const { existsSync } = require('node:fs');
    expect(existsSync(join(root, 'app/api/driver/v1/push-debug/route.ts'))).toBe(false);
    for (const rel of [
      'app/api/driver/v1/internal/dispatch-tick/route.ts',
      'app/api/driver/v1/internal/push-flush/route.ts',
      'app/api/driver/v1/internal/repush-loop/route.ts',
    ]) {
      expect(source(rel)).toContain('BISS_INTERNAL_TOKEN');
    }
  });
});

// Live-Bug 14.08.: Angebot hing allein an Push+Realtime — beides tot = Tour verfällt ungesehen.
describe('offer polling fallback while waiting', () => {
  it('polls for offers when online and idle', () => {
    const client = source('app/fahrer/app/client.tsx');
    expect(client).toContain('if (!isOnline || activeBatch || pickOpen) return;');
    expect(client).toContain('setInterval(() => router.refresh(), 15_000)');
  });

  it('driver going online survives the stale-offline cron', () => {
    const route = source('app/api/driver/v1/me/position/route.ts');
    expect(route).toContain("update({ state: 'idle' })");
    expect(route).toContain("eq('state', 'offline')");
    const migration = source('scripts/migrations/061_driver_online_grace_period.sql');
    expect(migration).toContain('shift_started_at');
    expect(migration).toContain("interval '10 minutes'");
  });
});

// Live-Bug 14.08.: defekter Push-Token stornierte jede Tour Sekunden nach dem Anbieten.
describe('broken push channel must not steal an active driver tour', () => {
  it('requeue is skipped while the driver app is alive', () => {
    const route = source('app/api/driver/v1/internal/push-flush/route.ts');
    const fn = route.slice(route.indexOf('async function requeueFailedAssignment'), route.indexOf('export async function POST'));
    expect(fn).toContain('last_foreground_at');
    expect(fn).toContain('Date.now() - lastForeground < 120_000');
    // VoIP-Anrufbildschirm ist per Default aus
    expect(route).toContain("process.env.DELIVERY_VOIP_PUSH_ENABLED === 'true'");
  });

  it('position ping keeps last_active_at fresh', () => {
    expect(source('app/api/driver/v1/me/position/route.ts')).toContain('last_active_at: now');
  });

  it('background GPS stays alive without suppressing the visible push', () => {
    const migration = source('scripts/migrations/064_native_background_gps.sql');
    const flush = source('app/api/driver/v1/internal/push-flush/route.ts');
    expect(migration).toContain('last_foreground_at');
    expect(migration).toContain("p_metadata->>'app_state'");
    expect(flush).toContain('last_foreground_at');
    expect(flush).not.toContain('Date.now() - lastActive < 25_000');
  });
});

// 14.08.: Ein Fehltipp buchte Bargeld als kassiert. Der letzte Schritt verlangt jetzt eine Wischgeste.
describe('cash delivery cannot be booked by an accidental tap', () => {
  const view = () => source('app/fahrer/app/delivery-view.tsx');

  it('the proof sheet confirms via swipe, not a tap', () => {
    const v = view();
    expect(v).toContain('function SwipeToConfirm');
    // Die Buchung haengt am Regler, nicht mehr an einem Button
    const sheet = v.slice(v.indexOf('<SwipeToConfirm'), v.indexOf('<SwipeToConfirm') + 600);
    expect(sheet).toContain('onConfirm={() => confirmDeliveryWithProof');
    expect(sheet).toContain('Zum Kassieren wischen');
  });

  it('only a near-complete swipe triggers the booking', () => {
    const v = view();
    const fn = v.slice(v.indexOf('function SwipeToConfirm'), v.indexOf('function StopEtaBar'));
    expect(fn).toContain('maxX() * 0.85');
  });

  it('delivered is booked through exactly one guarded path', () => {
    const v = view();
    // Definition + Regler im Nachweis-Blatt + Regler auf der Stopp-Karte
    expect(v.match(/confirmDeliveryWithProof\(/g)?.length).toBe(3);
    expect(v.match(/await markDelivered\(/g)?.length).toBe(1);
  });

  // Founder-Befund 14.08.: die gefaehrliche Flaeche lag auf der Stopp-Karte, nicht im Blatt.
  it('the stop card has no tappable delivery button left', () => {
    const v = view();
    const card = v.slice(v.indexOf('{/* Primär: NUR per Wischen'), v.indexOf('{/* Sekundäre Utility-Aktionen'));
    expect(card).toContain('<SwipeToConfirm');
    expect(card).toContain("confirmDeliveryWithProof(stop.id, 'handed_to_person')");
    // der verbleibende Knopf oeffnet nur das Nachweis-Blatt und bucht nichts
    expect(card).toContain('setProofModalStopId(stop.id)');
    expect(card).not.toMatch(/onClick=\{\(\) => confirmDeliveryWithProof/);
    expect(card).not.toContain('Kassiert & geliefert');
  });

  // Founder-Ablauf: nur die Bestellung, die gerade ausgeliefert wird, darf bestaetigt werden.
  it('only the current stop can be confirmed, never a later one', () => {
    const v = view();
    const gateStart = v.indexOf('{isNext && (() => {');
    const cardSwipe = v.indexOf('<SwipeToConfirm', v.indexOf('{/* Primär: NUR per Wischen'));
    const gateEnd = v.indexOf('{/* Sekundäre Utility-Aktionen');
    expect(gateStart).toBeGreaterThan(-1);
    // der Regler liegt INNERHALB des isNext-Blocks
    expect(cardSwipe).toBeGreaterThan(gateStart);
    expect(cardSwipe).toBeLessThan(gateEnd);
  });
});

// Founder-Ablauf 14.08.: Picken soll eine Wisch-Strecke ueber die ganze Tour sein,
// mit Zurueckwischen zum Kontrollieren und einer Abschluss-Seite "Route berechnen".
describe('picking runs as one swipeable tour, not one dialog per order', () => {
  const dlg = () => source('app/fahrer/app/pick-dialog.tsx');

  it('the dialog receives the whole tour', () => {
    const d = dlg();
    expect(d).toContain('orders: PickOrder[]');
    expect(d).not.toContain('orderBestellnummer');
    // eine Seite pro Bestellung + Abschluss-Seite
    expect(d).toContain('const pageCount = local.length + 1');
  });

  it('a finished order advances to the next one by itself', () => {
    const d = dlg();
    expect(d).toContain('autoAdvanced');
    expect(d).toContain('Math.min(pageCount - 1, p + 1)');
  });

  it('the driver can swipe back to check an already picked order', () => {
    const d = dlg();
    expect(d).toContain('goTo(page - 1)');
    expect(d).toContain('zum Kontrollieren zurückwischen');
  });

  it('nobody can skip past an unpicked order', () => {
    const d = dlg();
    // maxPage endet an der ersten ungepickten Bestellung
    expect(d).toContain('const firstOpen = local.findIndex((o) => !orderDone(o))');
    expect(d).toContain('Math.min(maxPage, p)');
  });

  it('the last page is the deliberate route step', () => {
    const d = dlg();
    expect(d).toContain('Route berechnen');
    expect(d).toContain('disabled={!allOrdersDone || routePending}');
    expect(d).toContain('onClick={onRouteReady}');
  });

  it('the caller hands over every order of the batch', () => {
    const c = source('app/fahrer/app/client.tsx');
    expect(c).toContain('orders={pickOrders}');
    expect(c).toContain('onRouteReady={() => {');
    expect(c).toContain('completeAndRoute(activeBatch.id)');
  });
});

// Founder-Befund 14.08.: "System geht auf dem Handy von selbst offline."
describe('a driver stays online until he says otherwise', () => {
  it('the offline watchdog counts the app heartbeat, not just GPS', () => {
    const mig = source('scripts/migrations/062_driver_stays_online_while_app_alive.sql');
    expect(mig).toContain('GREATEST(last_position_at, last_active_at)');
    expect(mig).toContain('CREATE OR REPLACE FUNCTION public.mark_stale_drivers_offline');
    // updated_at darf die Uhr NICHT dauerhaft frisch halten
    expect(mig).not.toContain('COALESCE(updated_at,       ');
  });

  it('reopening the app brings the driver straight back online', () => {
    const hb = source('app/api/driver/v1/me/heartbeat/route.ts');
    expect(hb).toContain("update({ state: 'idle' })");
    expect(hb).toContain("['offline', 'stale'].includes(driver.state as string)");
    expect(hb).toContain('hasCurrentDriverSession(');
    expect(hb).toContain("'driver_shift_cutoff_minute'");
  });

  it('going online never reports success on an unwritten status', () => {
    const route = source('app/api/driver/v1/session/start/route.ts');
    // kein fire-and-forget mehr
    expect(route).not.toContain('.upsert(statusPatch).then(() => {})');
    expect(route).toContain('await c.from(\'driver_status\').upsert(statusPatch)');
    expect(route).toContain('status_written');
    const client = source('app/fahrer/app/client.tsx');
    expect(client).toContain('const { error: statusError } = await supabase.from(\'driver_status\').upsert');
  });
});
