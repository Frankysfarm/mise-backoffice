import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260820065751_secure_tour_modifications_tenant_rls.sql',
  ),
  'utf8',
);

describe('tour modification tenant RLS', () => {
  it('does not authorize through user-editable metadata', () => {
    expect(migration).not.toMatch(/raw_user_meta_data|user_metadata/);
  });

  it('binds authenticated users to employee and tenant ownership', () => {
    expect(migration).toContain('employee.auth_user_id = (select auth.uid())');
    expect(migration).toContain('location.tenant_id = employee.tenant_id');
    expect(migration).toContain('location.id = tour_modifications.location_id');
  });

  it('uses explicit least-privilege Data API grants', () => {
    expect(migration).toContain(
      'revoke all on table public.tour_modifications from public, anon, authenticated',
    );
    expect(migration).toContain(
      'grant select on table public.tour_modifications to authenticated',
    );
  });
});
