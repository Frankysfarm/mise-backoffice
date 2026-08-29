import { describe, expect, it } from 'vitest';
import {
  isMiseOsScreen,
  MISE_OS_NATIVE_ROUTES,
  MISE_OS_SCREENS,
} from '@/lib/mise-os';
import { POST as retireLegacySso } from '@/app/api/mise-os/sso/route';
import { NextRequest } from 'next/server';

describe('Neo ↔ Mise OS fusion contract', () => {
  it('exposes every finished operating-system screen through the allowlist', () => {
    expect(Object.keys(MISE_OS_SCREENS)).toEqual([
      'dashboard',
      'builder',
      'schulung',
      'bereiche',
      'dienstplan',
      'rezeptbuch',
      'lager',
      'compliance',
    ]);
    expect(isMiseOsScreen('dienstplan')).toBe(true);
    expect(isMiseOsScreen('unknown')).toBe(false);
  });

  it('maps every former Mise OS screen to one native Neo module', () => {
    expect(Object.keys(MISE_OS_NATIVE_ROUTES)).toEqual(Object.keys(MISE_OS_SCREENS));
    expect(MISE_OS_NATIVE_ROUTES.dienstplan).toBe('/neo/app/dienstplan');
    expect(MISE_OS_NATIVE_ROUTES.bereiche).toBe('/neo/app/mitarbeiter');
    expect(Object.values(MISE_OS_NATIVE_ROUTES).every((route) => !route.startsWith('/neo/os'))).toBe(true);
  });

  it('retires the legacy SSO writer instead of opening a second session', async () => {
    const response = await retireLegacySso(new NextRequest('https://mise-gastro.de/api/mise-os/sso', { method: 'POST' }));
    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({ redirect: '/neo' });
  });
});
