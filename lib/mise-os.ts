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

export const MISE_OS_NATIVE_ROUTES: Record<MiseOsScreen, string> = {
  dashboard: '/neo',
  builder: '/neo/app/ablaeufe',
  schulung: '/neo/app/schulungen',
  bereiche: '/neo/app/mitarbeiter',
  dienstplan: '/neo/app/dienstplan',
  rezeptbuch: '/neo/app/rezeptbuch',
  lager: '/neo/app/lager',
  compliance: '/neo/app/compliance',
};

export function isMiseOsScreen(value: string): value is MiseOsScreen {
  return Object.prototype.hasOwnProperty.call(MISE_OS_SCREENS, value);
}
