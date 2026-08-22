import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { InventoryEditor } from '../../editor';
import { operationsBasePath } from '@/lib/routing/operations-base-path';

export default async function ManageInventoryProductsPage() {
  const currentEmployee = await requireManagerPlus();
  if (!currentEmployee.tenant_id) throw new Error('Mitarbeiterkonto ist keinem Mandanten zugeordnet.');
  const basePath = await operationsBasePath('/inventory', '/neo/app/lager');
  const supabase = await createClient();

  const [{ data: areas }, { data: items }, { data: locations }] = await Promise.all([
    supabase
      .from('inventory_areas')
      .select('id,name,beschreibung,location_id,location:locations!inner(name,tenant_id)')
      .eq('location.tenant_id', currentEmployee.tenant_id)
      .order('name'),
    supabase
      .from('inventory_items')
      .select('id,area_id,name,artikelnummer,einheit,soll_bestand,min_bestand,lieferant,preis_pro_einheit,aktiv,area:inventory_areas!inner(location:locations!inner(tenant_id))')
      .eq('area.location.tenant_id', currentEmployee.tenant_id)
      .eq('aktiv', true)
      .order('name'),
    supabase.from('locations').select('id,name').eq('tenant_id', currentEmployee.tenant_id).order('name'),
  ]);

  return (
    <div>
      <PageHeader
        backHref={`${basePath}/products`}
        title="Produkte verwalten"
        description="Lagerbereiche und Produktstammdaten anlegen, bearbeiten oder deaktivieren."
      />
      <InventoryEditor
        areas={(areas ?? []) as any}
        items={(items ?? []) as any}
        locations={locations ?? []}
      />
    </div>
  );
}
