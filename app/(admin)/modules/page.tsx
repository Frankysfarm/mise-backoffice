import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { MODULE_ENTRY_ROUTE } from '@/lib/modules';
import { ModulesGallery } from './client';

export const dynamic = 'force-dynamic';

export type PlatformModule = {
  id: string;
  name: string;
  beschreibung: string | null;
  icon: string | null;
  preis_monatlich: number | null;
  kategorie: string | null;
  sort_order: number;
  features: unknown;
  launch_status: 'ready' | 'coming_soon' | 'beta';
  launch_eta: string | null;
};

export type TenantModule = {
  module_id: string;
  status: 'inaktiv' | 'trial' | 'aktiv' | 'abgelaufen' | 'gekuendigt' | null;
  aktiv: boolean;
  ablauf_am: string | null;
  test_gestartet_am: string | null;
};

export default async function ModulesPage({
  searchParams,
}: {
  searchParams?: Promise<{ locked?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const lockedModule = params.locked;
  const emp = await requireManagerPlus();
  if (!emp.tenant_id) redirect('/start');
  const svc = createServiceClient();

  const [{ data: platformModules }, { data: tenantModules }] = await Promise.all([
    svc.from('platform_modules').select('*').eq('aktiv', true).order('sort_order'),
    svc.from('tenant_modules').select('module_id, status, aktiv, ablauf_am, test_gestartet_am').eq('tenant_id', emp.tenant_id),
  ]);

  return (
    <>
      <PageHeader
        title="Alle Module"
        description="Deine aktiven Module und was du noch testen kannst."
        backHref="/"
      />
      {lockedModule && (
        <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50/70 p-4 text-sm text-amber-900">
          <strong>Modul nicht aktiv:</strong> Du hast gerade versucht <span className="font-mono">{lockedModule}</span> zu öffnen. Starte erst den Test oder buche es weiter unten.
        </div>
      )}
      <ModulesGallery
        modules={(platformModules as PlatformModule[]) ?? []}
        status={(tenantModules as TenantModule[]) ?? []}
        routeMap={MODULE_ENTRY_ROUTE}
      />
    </>
  );
}
