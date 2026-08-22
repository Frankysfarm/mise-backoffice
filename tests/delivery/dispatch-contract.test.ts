import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('delivery dispatch writer contract', () => {
  it('defaults the legacy writer to disabled', () => {
    const route = source('app/api/driver/v1/internal/dispatch-tick/route.ts');
    expect(route).toContain("process.env.DELIVERY_LEGACY_DISPATCH_ENABLED !== 'true'");
    expect(route).toContain("{ ok: true, disabled: true, writer: 'smart-dispatch' }");
    expect(route).not.toContain("{ status: 409 }");
  });

  it('uses database RPCs for claim, accept, decline and requeue', () => {
    const dispatch = source('lib/delivery/dispatch-engine.ts');
    const accept = source('app/api/driver/v1/orders/accept/route.ts');
    const webDriver = source('app/fahrer/app/client.tsx');
    const decline = source('app/api/driver/v1/orders/decline/route.ts');
    const push = source('app/api/driver/v1/internal/push-flush/route.ts');
    expect(dispatch).toContain("rpc('claim_delivery_order'");
    expect(dispatch).not.toContain("from('mise_delivery_batches')\n      .insert");
    expect(accept).toContain("rpc('accept_delivery_batch'");
    expect(accept).toContain("query = query.eq('id', body.batch_id)");
    expect(webDriver).toContain("fetch('/api/driver/v1/orders/accept'");
    expect(webDriver).not.toContain("rpc('claim_mise_delivery_batch'");
    expect(decline).toContain("rpc('decline_delivery_batch'");
    expect(push).toContain("rpc('requeue_delivery_batch'");
    expect(push).toContain("requeueFailedAssignment(c, row, 'push_enabled=false')");
    expect(push).toContain("requeueFailedAssignment(c, row, 'no expo token')");
    expect(push).toContain("requeueFailedAssignment(c, row, r.error ?? 'apns-alert-fail')");
    expect(push).toContain("requeueFailedAssignment(c, row, ticket.message ?? 'expo-ticket-failed')");
  });

  it('ships row locks, CAS and strict eligibility in migration 057', () => {
    const migration = source('scripts/migrations/057_delivery_dispatch_contract.sql');
    expect(migration).toContain('for update');
    expect(migration).toContain('order claim lost concurrent compare-and-set');
    expect(migration).toContain('mise_driver_is_dispatch_eligible');
    expect(migration).toContain("membership.status='active'");
    expect(migration).toContain('d.last_position_at is not null');
    expect(migration).toContain('d.last_lat is not null');
    expect(migration).toContain('d.last_lng is not null');
    expect(migration).toContain('d.push_enabled');
    expect(migration).toContain('d.approved_at is not null');
    expect(migration).toContain("at time zone 'Europe/Berlin'");
    expect(migration).toContain("driver already has an active delivery batch");
    expect(migration).toContain("perform 1 from public.mise_drivers where id=p_driver_id for update");
    expect(migration).toContain('revoke all on function public.claim_mise_delivery_batch(uuid,uuid)');
    expect(migration).toContain("v_batch.state in ('assigned','at_restaurant')");
    expect(migration).toContain('driver_stale_after_pickup_manual_intervention');
    expect(migration).toContain('offer_expired_before_acceptance');
  });

  it('treats scoped web push as a reliable browser-driver channel', () => {
    const migration = source('scripts/migrations/058_delivery_browser_push_contract.sql');
    const enqueue = source('lib/delivery/push-notify.ts');
    const webFlush = source('app/api/drivers/push/send/route.ts');
    const webDriver = source('app/fahrer/app/client.tsx');
    expect(migration).toContain('driver_push_subscriptions');
    expect(migration).toContain('web_employee.tenant_id=p_tenant_id');
    expect(migration).toContain('web_employee.location_id=p_location_id');
    expect(enqueue).toContain("from('driver_push_outbox').insert");
    expect(webFlush).toContain("rpc('requeue_delivery_batch'");
    expect(webFlush).toContain('webpush_all_failed');
    expect(webDriver).toContain('await ensureBrowserPushSubscription();');
    expect(webDriver).toContain("fetch('/api/drivers/push/subscribe'");
  });

  it('uses a calm planning notification for internal fleet tours', () => {
    const enqueue = source('lib/delivery/push-notify.ts');
    const flush = source('app/api/driver/v1/internal/push-flush/route.ts');
    expect(enqueue).toContain("type:      'tour_planned'");
    expect(enqueue).toContain("sound:    'default'");
    expect(enqueue).toContain("priority: 'normal'");
    expect(enqueue).not.toContain("sound:    'alarm.caf'");
    expect(flush).toContain("row.type === 'tour_planned'");
    expect(flush).toContain('isUrgentAssign');
    expect(flush).toContain('voipEnabled && isUrgentAssign');
    expect(flush).toContain("sound: row.sound ?? 'default'");
    expect(flush).not.toContain("body: row.body,\n        sound: 'default'");
    const apns = source('lib/apns-alert.ts');
    expect(apns).toContain("'content-available': 1");
    expect(apns).toContain("headers['apns-collapse-id']");
    expect(apns).toContain("'apns-expiration'");
  });
});
