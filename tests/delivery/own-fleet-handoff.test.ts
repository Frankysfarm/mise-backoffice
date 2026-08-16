import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('own-fleet QR handoff contract', () => {
  const migration = source('scripts/migrations/066_own_fleet_qr_handoff.sql');

  it('plans internal tours directly without a driver acceptance race', () => {
    expect(migration).toContain("'own_fleet','planned',now()");
    expect(migration).toContain("p_driver_id,v_location.id,'assigned'");
    expect(migration).toContain('accepted_at');
    expect(migration).toContain('plan_expires_at');
    expect(migration).not.toContain("'pending_acceptance',p_zone,p_dispatch_score");
  });

  it('locks the batch and requires every bag before custody starts', () => {
    expect(migration).toContain('scan_delivery_pickup_bag');
    expect(migration).toContain('for update');
    expect(migration).toContain("s.type='dropoff'");
    expect(migration).toContain("'required_bags',v_bag_count");
    expect(migration).toContain("handoff_state='committed'");
    expect(migration).toContain('Erst alle Beutel-QR-Codes scannen');
  });

  it('enforces ownership and least privilege on all pickup functions', () => {
    expect(migration).toContain('b.driver_id=v_driver_id');
    expect(migration).toContain('driver_id=p_driver_id');
    expect(migration).toContain('security definer set search_path=public,pg_temp');
    expect(migration).toContain('revoke all on function public.scan_delivery_pickup_bag');
    expect(migration).toContain('to service_role');
    expect(migration).toContain('to authenticated,service_role');
  });

  it('freezes bundling after the first handoff scan', () => {
    const bundling = source('lib/delivery/bundling.ts');
    expect(bundling).toContain(".eq('assignment_mode', 'own_fleet')");
    expect(bundling).toContain(".eq('handoff_state', 'planned')");
    expect(migration).toContain("v_batch.handoff_state<>'planned'");
  });

  it('prints signed per-bag QR labels and accepts only verified scans', () => {
    const kitchen = source('app/kuche/[token]/client.tsx');
    const route = source('app/api/driver/v1/batch/[id]/handoff/scan/route.ts');
    const qr = source('lib/delivery/pickup-qr.ts');
    expect(kitchen).toContain('QRCode.toDataURL');
    expect(kitchen).toContain('ERSATZCODE');
    expect(route).toContain('parseAndVerifyPickupQr');
    expect(route).toContain("rpc('scan_delivery_pickup_bag'");
    expect(qr).toContain("createHmac('sha256'");
    expect(qr).toContain('timingSafeEqual');
  });

  it('keeps internal planning free of repeated driver alarms', () => {
    const driver = source('app/fahrer/app/client.tsx');
    const alarm = source('app/fahrer/app/alarm-ringer.tsx');
    expect(driver).toContain("activeBatch.assignment_mode === 'own_fleet'");
    expect(driver).toContain('Übergabe scannen');
    expect(driver).not.toContain('assignedBatchId=');
    expect(alarm).toContain('played >= 3');
    expect(alarm).toContain('8000');
  });

  it('blocks the legacy picked-up endpoint for own-fleet batches', () => {
    const route = source('app/api/driver/v1/orders/[id]/picked-up/route.ts');
    expect(route).toContain("batch.assignment_mode === 'own_fleet'");
    expect(route).toContain("code: 'qr_handoff_required'");
  });
});
