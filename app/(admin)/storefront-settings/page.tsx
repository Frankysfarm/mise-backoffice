import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from 'next/navigation';
import { StorefrontSettingsClient } from './client';

export const dynamic = 'force-dynamic';

export default async function StorefrontSettingsPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, slug, storefront_settings, free_delivery_threshold, mindestbestellwert, liefergebuehr, durchschnittliche_lieferzeit_min')
    .eq('id', user.user_metadata?.tenant_id ?? '')
    .maybeSingle();

  const { data: products } = await supabase
    .from('menu_items')
    .select('id, name, preis, category_id, menu_categories(name)')
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
