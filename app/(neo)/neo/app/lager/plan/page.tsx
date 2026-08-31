import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { WarehousePlan } from './warehouse-plan';

export default async function WarehousePlanPage() {
  const actor = await requireManagerPlus();
  if (!actor.tenant_id) throw new Error('Mitarbeiterkonto ist keinem Mandanten zugeordnet.');
  const supabase = await createClient();
  const [{ data: areas }, { data: shelves }, { data: items }] = await Promise.all([
    supabase.from('inventory_areas').select('id,name,location_id,location:locations!inner(name,tenant_id)').eq('location.tenant_id', actor.tenant_id).order('name'),
    supabase.from('inventory_shelves').select('id,area_id,parent_shelf_id,name,place_kind,unit_type,beschreibung,position,qr_token,last_checked_at,last_checker:employees!inventory_shelves_last_checked_by_fkey(vorname,nachname),area:inventory_areas!inner(location:locations!inner(tenant_id))').eq('area.location.tenant_id', actor.tenant_id).order('position'),
    supabase.from('inventory_items').select('id,name,shelf_id,soll_bestand,min_bestand,letzte_inventur,aktiv,area:inventory_areas!inner(location:locations!inner(tenant_id))').eq('area.location.tenant_id', actor.tenant_id).eq('aktiv', true),
  ]);
  return <div className="space-y-6"><PageHeader backHref="/neo/app/lager" title="Visueller Lagerplan" description="Räume, Regale, Kühlgeräte und Lagerplätze übersichtlich organisieren." /><WarehousePlan areas={(areas ?? []) as any} shelves={(shelves ?? []) as any} items={(items ?? []) as any} /></div>;
}
