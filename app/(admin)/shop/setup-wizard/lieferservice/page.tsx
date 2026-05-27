import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { LieferserviceWizardClient } from './client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Lieferservice einrichten · Mise' };

export default async function LieferserviceWizardPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb
    .from('employees')
    .select('tenant_id,location_id')
    .eq('id', emp.id)
    .maybeSingle();
  if (!empRow?.tenant_id || !empRow.location_id) redirect('/start');

  const tenantId = empRow.tenant_id;
  const locationId = empRow.location_id;

  const [
    { data: tenant },
    { count: zonesCount },
    { count: menuLieferbarCount },
    { data: hoursAny },
    { count: kioskCount },
  ] = await Promise.all([
    svc.from('tenants')
      .select('id, name, slug, stripe_connect_charges_enabled, logo_url, hero_image_url, custom_domain, delivery_test_order_at')
      .eq('id', tenantId).single(),
    svc.from('delivery_zones').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('aktiv', true),
    svc.from('menu_items').select('id', { count: 'exact', head: true })
      .eq('location_id', locationId).eq('verfuegbar', true),
    svc.from('opening_hours').select('id').eq('location_id', locationId).limit(1).maybeSingle(),
    svc.from('employees').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('location_id', locationId).eq('position_typ', 'kiosk-lieferservice'),
  ]);

  const t = tenant as {
    id: string; name: string; slug: string;
    stripe_connect_charges_enabled: boolean | null;
    logo_url: string | null; hero_image_url: string | null;
    custom_domain: string | null;
    delivery_test_order_at: string | null;
  };

  const stepStatus = {
    stripe: Boolean(t.stripe_connect_charges_enabled),
    zones: (zonesCount ?? 0) > 0,
    hours: Boolean(hoursAny),
    menu: (menuLieferbarCount ?? 0) > 0,
    design: Boolean(t.logo_url || t.hero_image_url),
    printer: true, // wird in /pos/printers verwaltet — Status hier visuell
    kioskAccount: (kioskCount ?? 0) > 0,
    domain: Boolean(t.custom_domain),
    test: Boolean(t.delivery_test_order_at),
  };

  return (
    <LieferserviceWizardClient
      tenantName={t.name}
      tenantSlug={t.slug}
      stepStatus={stepStatus}
      counts={{
        zones: zonesCount ?? 0,
        menuItems: menuLieferbarCount ?? 0,
      }}
    />
  );
}
