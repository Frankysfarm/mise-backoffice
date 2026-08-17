import { createServiceClient } from "@/lib/supabase/server";
import { redirect } from 'next/navigation';
import { StorefrontSettingsClient } from './client';
import { requireManagerPlus } from '@/lib/auth/requireRole';

export const dynamic = 'force-dynamic';

export default async function StorefrontSettingsPage() {
  const employee = await requireManagerPlus();
  const supabase = createServiceClient();
  const { data: employeeRow } = await supabase.from('employees').select('tenant_id').eq('id', employee.id).maybeSingle();
  if (!employeeRow?.tenant_id) redirect('/start');

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, slug, storefront_settings, free_delivery_threshold, mindestbestellwert, liefergebuehr, durchschnittliche_lieferzeit_min')
    .eq('id', employeeRow.tenant_id)
    .maybeSingle();

  const { data: locations } = await supabase.from('locations').select('id').eq('tenant_id', employeeRow.tenant_id);
  const locationIds = (locations ?? []).map((location) => location.id);

  const { data: products } = await supabase
    .from('menu_items')
    .select('id, name, preis, category_id, menu_categories(name)')
    .in('location_id', locationIds.length ? locationIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('verfuegbar', true)
    .order('name');

  const normalizedProducts = (products ?? []).map((p) => ({
    ...p,
    menu_categories: Array.isArray(p.menu_categories)
      ? (p.menu_categories[0] ?? null)
      : (p.menu_categories as { name: string } | null),
  }));

  return (
    <StorefrontSettingsClient
      tenant={tenant}
      products={normalizedProducts}
    />
  );
}
