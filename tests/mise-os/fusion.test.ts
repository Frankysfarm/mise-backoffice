import { describe, expect, it } from 'vitest';
import {
  isMiseOsScreen,
  mapEmployeeRoleToMiseOs,
  MISE_OS_SCREENS,
  getMiseOsAppUrl,
} from '@/lib/mise-os';

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

  it('maps Neo hierarchy roles to the Mise OS authorization model', () => {
    expect(mapEmployeeRoleToMiseOs('admin')).toBe('ADMIN');
    expect(mapEmployeeRoleToMiseOs('backoffice')).toBe('ADMIN');
    expect(mapEmployeeRoleToMiseOs('manager')).toBe('ADMIN');
    expect(mapEmployeeRoleToMiseOs('teamleiter')).toBe('SCHICHTLEITER');
    expect(mapEmployeeRoleToMiseOs('mitarbeiter')).toBe('MITARBEITER');
    expect(mapEmployeeRoleToMiseOs('cook')).toBe('MITARBEITER');
  });

  it('only accepts HTTPS for a remote Mise OS deployment', () => {
    const before = process.env.MISE_OS_APP_URL;
    try {
      process.env.MISE_OS_APP_URL = 'https://os.example.test/';
      expect(getMiseOsAppUrl()).toBe('https://os.example.test');
      process.env.MISE_OS_APP_URL = 'http://os.example.test';
      expect(() => getMiseOsAppUrl()).toThrow(/HTTPS/i);
    } finally {
      if (before === undefined) delete process.env.MISE_OS_APP_URL;
      else process.env.MISE_OS_APP_URL = before;
    }
  });
});
