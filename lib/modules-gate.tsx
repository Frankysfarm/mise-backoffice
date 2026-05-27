import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getActiveModules, matchRouteToModule } from './modules';

/**
 * Ruft in Admin-Seiten/Layouts auf, um zu prüfen ob der Tenant Zugriff hat.
 * Macht Prefix-Match — `/pos/anything` matched also über `/pos`.
 * Bei fehlendem Modul → /modules (mit Hinweis).
 */
export async function requireActiveModule(route: string) {
  const moduleId = matchRouteToModule(route);
  if (!moduleId) return; // nicht gemapped = frei zugänglich

  const active = await getActiveModules();
  if (active.has(moduleId)) return;

  redirect(`/modules?locked=${moduleId}`);
}

/** Aktueller Pfad über Headers (Next.js Server-Component-safe) */
export async function currentPath(): Promise<string> {
  const h = await headers();
  return h.get('x-invoke-path') ?? h.get('x-pathname') ?? '/';
}
