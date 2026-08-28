import type { EmployeeRole } from '@/lib/auth/getCurrentEmployee';

export const MISE_OS_SCREENS = {
  dashboard: 'Dashboard',
  builder: 'Listen & Abläufe',
  schulung: 'Schulungen',
  bereiche: 'Mitarbeiter & Bereiche',
  dienstplan: 'Dienstplan',
  rezeptbuch: 'Rezeptbuch',
  lager: 'Lager',
  compliance: 'Team & Compliance',
} as const;

export type MiseOsScreen = keyof typeof MISE_OS_SCREENS;

export function isMiseOsScreen(value: string): value is MiseOsScreen {
  return Object.prototype.hasOwnProperty.call(MISE_OS_SCREENS, value);
}

export function mapEmployeeRoleToMiseOs(role: EmployeeRole): 'MITARBEITER' | 'SCHICHTLEITER' | 'ADMIN' {
  if (role === 'admin' || role === 'backoffice' || role === 'manager') return 'ADMIN';
  if (role === 'teamleiter') return 'SCHICHTLEITER';
  return 'MITARBEITER';
}

function safeHttpsUrl(raw: string, fallback: string): string {
  const url = new URL(raw || fallback);
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !local) throw new Error('Mise OS URL must use HTTPS');
  return url.toString().replace(/\/$/, '');
}

export function getMiseOsAppUrl(): string {
  return safeHttpsUrl(
    process.env.MISE_OS_APP_URL ?? '',
    'https://mise-os-theta.vercel.app',
  );
}

export function getMiseOsApiUrl(): string {
  return safeHttpsUrl(
    process.env.MISE_OS_API_URL ?? '',
    'https://mise-gastro.de/api/v1',
  );
}
