import { cache } from 'react';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export type ModuleStatusRecord = {
  module_id: string;
  status: 'inaktiv' | 'trial' | 'aktiv' | 'abgelaufen' | 'gekuendigt' | null;
  aktiv: boolean;
  ablauf_am: string | null;
  test_gestartet_am: string | null;
};

/**
 * Zentrale Definition aller Plattform-Module + ihre Routen.
 *
 * `entryRoute` = wohin springt der „Öffnen"-Button in der Modul-Galerie.
 * `routes`     = alle Backoffice-Routen die zu diesem Modul gehören. Routen
 *                ohne Eintrag hier sind frei (Admin-Basis: /settings, /modules,
 *                /locations, /departments). Prefix-Match wird in `matchRouteToModule`
 *                gemacht — `/pos/anything` matched also über `/pos`.
 *
 * Alle abgeleiteten Maps (ROUTE_MODULE_MAP, MODULE_ENTRY_ROUTE) kommen aus
 * dieser Quelle. So bleibt das Module-System single-source-of-truth.
 */
type ModuleId =
  | 'cash' | 'ordering' | 'kitchen' | 'delivery'
  | 'operations' | 'training' | 'cleaning' | 'checkups'
  | 'inventory' | 'analytics' | 'documents' | 'notifications'
  | 'table_ordering' | 'voice_orders';

type ModuleDefinition = {
  entryRoute: string;
  routes: readonly string[];
};

const MODULE_DEFINITIONS: Record<ModuleId, ModuleDefinition> = {
  ordering: {
    entryRoute: '/shop',
    routes: [
      '/shop', '/shop/design', '/shop/hours', '/shop/payments',
      '/shop/drivers', '/shop/delivery', '/shop/domain', '/shop/qr-design',
      '/menu', '/vouchers', '/recipes',
    ],
  },
  table_ordering: {
    entryRoute: '/qr-bestellsystem',
    routes: ['/qr-bestellsystem'],
  },
  kitchen: {
    entryRoute: '/kitchen',
    routes: ['/kitchen'],
  },
  delivery: {
    entryRoute: '/drivers',
    routes: ['/drivers', '/dispatch', '/delivery', '/delivery/platforms', '/delivery/zone', '/delivery/conditions'],
  },
  cash: {
    entryRoute: '/pos/terminal',
    routes: [
      '/pos', '/pos/terminal', '/pos/registers', '/pos/tables', '/pos/tables/layout',
      '/pos/stations', '/pos/stations/devices', '/pos/z-report', '/cash',
      '/settings/tse', '/settings/legal', '/settings/kassenpruefung',
      '/settings/manager-pin', '/settings/sumup',
    ],
  },
  operations: {
    entryRoute: '/schedule',
    routes: ['/employees', '/schedule', '/applications', '/shift-guides', '/equipment'],
  },
  training: {
    entryRoute: '/training',
    routes: ['/training', '/badges'],
  },
  cleaning: {
    entryRoute: '/cleaning',
    routes: ['/cleaning'],
  },
  checkups: {
    entryRoute: '/checkups',
    routes: ['/checkups'],
  },
  inventory: {
    entryRoute: '/inventory',
    routes: ['/inventory', '/inventory/sessions', '/inventory/orders'],
  },
  analytics: {
    entryRoute: '/analytics',
    routes: ['/analytics'],
  },
  documents: {
    entryRoute: '/documents',
    routes: ['/documents'],
  },
  notifications: {
    entryRoute: '/notifications',
    routes: ['/notifications', '/campaigns'],
  },
  voice_orders: {
    entryRoute: '/voice-orders',
    routes: ['/voice-orders'],
  },
};

/** Route → ModuleId. Abgeleitet aus MODULE_DEFINITIONS. */
export const ROUTE_MODULE_MAP: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(MODULE_DEFINITIONS).flatMap(
      ([id, def]) => def.routes.map((r) => [r, id] as const),
    ),
  ),
);

/** ModuleId → Entry-Route. Abgeleitet aus MODULE_DEFINITIONS. */
export const MODULE_ENTRY_ROUTE: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(MODULE_DEFINITIONS).map(([id, def]) => [id, def.entryRoute] as const),
  ),
);

/**
 * Findet das passende Modul für eine Route (längstes Prefix gewinnt).
 * Gibt null zurück wenn die Route keinem Modul zugeordnet ist.
 */
export function matchRouteToModule(pathname: string): string | null {
  let best: string | null = null;
  for (const route of Object.keys(ROUTE_MODULE_MAP)) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      if (!best || route.length > best.length) best = route;
    }
  }
  return best ? ROUTE_MODULE_MAP[best] : null;
}

/** Aktive = trial (nicht abgelaufen) ODER bezahlt */
function isLive(r: Pick<ModuleStatusRecord, 'status' | 'aktiv' | 'ablauf_am'>): boolean {
  if (!r.aktiv) return false;
  if (r.status === 'aktiv') return true;
  if (r.status === 'trial' && (!r.ablauf_am || new Date(r.ablauf_am) > new Date())) return true;
  return false;
}

/** Tenant-ID des eingeloggten Users. Liest aus `employees`. */
const getTenantIdForCurrentUser = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const svc = createServiceClient();
  const { data: emp } = await svc
    .from('employees')
    .select('tenant_id')
    .eq('auth_user_id', user.id)
    .maybeSingle<{ tenant_id: string | null }>();
  return emp?.tenant_id ?? null;
});

/**
 * Set der momentan live nutzbaren Module für den eingeloggten Tenant.
 * Gecacht pro Request.
 */
export const getActiveModules = cache(async (): Promise<Set<string>> => {
  const tenantId = await getTenantIdForCurrentUser();
  if (!tenantId) return new Set();

  const svc = createServiceClient();
  const { data } = await svc
    .from('tenant_modules')
    .select('module_id, status, aktiv, ablauf_am')
    .eq('tenant_id', tenantId)
    .returns<Pick<ModuleStatusRecord, 'module_id' | 'status' | 'aktiv' | 'ablauf_am'>[]>();

  const active = new Set<string>();
  for (const row of data ?? []) {
    if (isLive(row)) active.add(row.module_id);
  }
  return active;
});

/** Alle Module mit vollem Status für den aktuellen Tenant. */
export const getTenantModules = cache(async (): Promise<ModuleStatusRecord[]> => {
  const tenantId = await getTenantIdForCurrentUser();
  if (!tenantId) return [];

  const svc = createServiceClient();
  const { data } = await svc
    .from('tenant_modules')
    .select('module_id, status, aktiv, ablauf_am, test_gestartet_am')
    .eq('tenant_id', tenantId)
    .returns<ModuleStatusRecord[]>();

  return data ?? [];
});

/** Routen die immer erreichbar sind (Admin-Basis, kein Modul nötig). */
const ALWAYS_OPEN_PREFIXES = ['/settings', '/locations', '/departments'] as const;
const ALWAYS_OPEN_EXACT = new Set(['/', '/setup', '/dashboard', '/modules']);

/**
 * Prüft ob eine Route für den Tenant erreichbar ist.
 * Admin/Settings-Routen sind immer erreichbar.
 */
export function isRouteActive(href: string, activeModules: Set<string>): boolean {
  if (ALWAYS_OPEN_EXACT.has(href)) return true;
  if (ALWAYS_OPEN_PREFIXES.some((p) => href === p || href.startsWith(p + '/'))) return true;

  const moduleId = ROUTE_MODULE_MAP[href];
  if (!moduleId) return true; // unmapped → sichtbar (Fallback)
  return activeModules.has(moduleId);
}
