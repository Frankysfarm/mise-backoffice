import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('explicit driver duty status', () => {
  const migration = source('scripts/migrations/065_driver_duty_availability.sql');

  it('separates authentication from dispatch availability', () => {
    expect(migration).toContain("dispatch_availability in ('off_duty','available','paused')");
    expect(migration).toContain("and d.dispatch_availability='available'");
    expect(migration).toContain("availability_reason='inactivity'");
    expect(migration).toContain("availability_reason='cutoff'");
  });

  it('makes pause and end atomic while protecting an active tour', () => {
    expect(migration).toContain('pause_driver_dispatch_session');
    expect(migration).toContain('resume_driver_dispatch_session');
    expect(migration).toContain("if v_has_batch and not p_allow_active_batch then raise exception 'driver has an active delivery batch'");
    expect(migration).toContain("dispatch_availability='off_duty'");
    expect(migration).toContain('for update of d skip locked');
  });

  it('does not let heartbeat or GPS silently undo a pause', () => {
    const heartbeat = source('app/api/driver/v1/me/heartbeat/route.ts');
    const position = source('app/api/driver/v1/me/position/route.ts');
    const snapshot = source('app/api/driver/v2/snapshot/route.ts');
    expect(heartbeat).toContain("driver.dispatch_availability === 'available'");
    expect(position).toContain(".eq('dispatch_availability', 'available')");
    expect(snapshot).toContain("current?.dispatch_availability === 'available' || Boolean(activeBatch)");
    expect(migration).toContain("v_driver.dispatch_availability<>'available' and v_batch_id is null");
  });

  it('exposes clear driver and backoffice controls', () => {
    const client = source('app/fahrer/app/client.tsx');
    const admin = source('app/(admin)/drivers/client.tsx');
    const adminRoute = source('app/api/admin/drivers/duty/route.ts');
    expect(client).toContain('Schicht starten');
    expect(client).toContain('Weiterarbeiten');
    expect(client).toContain('Sicherheitspause');
    expect(client).toContain('Du bist angemeldet, aber nicht im Dienst');
    expect(admin).toContain('Zuweisungen stoppen');
    expect(adminRoute).toContain("['manager', 'backoffice', 'admin'].includes(ctx.role)");
    expect(adminRoute).toContain(".eq('tenant_id', ctx.tenant_id)");
    expect(adminRoute).toContain('p_allow_active_batch: true');
  });

  it('keeps privileged transition functions service-only', () => {
    expect(migration).toContain('revoke all on function public.pause_driver_dispatch_session(uuid,text,boolean) from public,anon,authenticated');
    expect(migration).toContain('grant execute on function public.pause_driver_dispatch_session(uuid,text,boolean) to service_role');
    expect(migration).toContain('revoke all on function public.resume_driver_dispatch_session(uuid,uuid) from public,anon,authenticated');
  });
});
