import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { getActiveModules } from '@/lib/modules';
import { SetupWizardClient } from './client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Setup-Wizard · Mise' };

export default async function SetupWizardPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb.from('employees').select('tenant_id,location_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id || !empRow.location_id) redirect('/start');

  const tenantId = empRow.tenant_id;
  const locationId = empRow.location_id;

  const [
    { data: tenant },
    { count: categoriesCount },
    { count: itemsCount },
    { count: employeesCount },
    { count: taxRatesCount },
    { count: registersCount },
    { count: tablesCount },
    { count: stationsCount },
    { data: posSettings },
    activeModules,
  ] = await Promise.all([
    svc.from('tenants')
      .select('id, name, slug, wizard_completed_at, wizard_skipped_at, wizard_active_step, wizard_mode, stripe_connect_charges_enabled, custom_domain, custom_domain_status, logo_url, hero_image_url, sumup_affiliate_key, sumup_verbunden_am')
      .eq('id', tenantId).single(),
    svc.from('menu_categories').select('id', { count: 'exact', head: true })
      .eq('location_id', locationId).eq('aktiv', true),
    svc.from('menu_items').select('id', { count: 'exact', head: true })
      .eq('location_id', locationId).eq('verfuegbar', true),
    svc.from('employees').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('aktiv', true),
    svc.from('tax_rates').select('id', { count: 'exact', head: true }).eq('aktiv', true),
    svc.from('pos_registers').select('id', { count: 'exact', head: true })
      .eq('location_id', locationId).eq('aktiv', true),
    svc.from('restaurant_tables').select('id', { count: 'exact', head: true })
      .eq('location_id', locationId).eq('aktiv', true),
    svc.from('kitchen_stations').select('id', { count: 'exact', head: true })
      .eq('location_id', locationId),
    svc.from('pos_settings').select('receipt_mode, kopf_zeile, fuss_zeile').eq('location_id', locationId).maybeSingle(),
    getActiveModules(),
  ]);

  const t = tenant as {
    id: string; name: string; slug: string;
    wizard_completed_at: string | null;
    wizard_skipped_at: string | null;
    wizard_active_step: number;
    wizard_mode: 'demo' | 'live';
    stripe_connect_charges_enabled: boolean | null;
    custom_domain: string | null; custom_domain_status: string | null;
    logo_url: string | null; hero_image_url: string | null;
    sumup_affiliate_key: string | null; sumup_verbunden_am: string | null;
  };

  const settings = posSettings as { receipt_mode?: string | null; kopf_zeile?: string | null; fuss_zeile?: string | null } | null;
  const receiptConfigured = Boolean(settings?.receipt_mode && (settings?.kopf_zeile || settings?.fuss_zeile));

  const stepStatus = {
    menu: (itemsCount ?? 0) > 0,
    categories: (categoriesCount ?? 0) > 0,
    user: (employeesCount ?? 0) >= 1,
    taxRates: (taxRatesCount ?? 0) > 0,
    modules: true,
    receipt: receiptConfigured,
    registers: (registersCount ?? 0) >= 1,
    tse: t.wizard_mode === 'demo',
  };

  const moduleFlags = {
    qrTisch: activeModules.has('ordering'),
    delivery: activeModules.has('delivery'),
    kitchen: activeModules.has('kitchen'),
    inventory: activeModules.has('inventory'),
    notifications: activeModules.has('notifications'),
  };

  const moduleSubStatus = {
    qrDesign: Boolean(t.logo_url || t.hero_image_url),
    qrTische: (tablesCount ?? 0) > 0,
    qrZahlung: Boolean(t.sumup_affiliate_key || t.stripe_connect_charges_enabled),
    stripe: Boolean(t.stripe_connect_charges_enabled),
    tischplan: (tablesCount ?? 0) > 0,
    kdsStations: (stationsCount ?? 0) > 0,
  };

  return (
    <SetupWizardClient
      tenantId={t.id}
      tenantName={t.name}
      tenantSlug={t.slug}
      completedAt={t.wizard_completed_at}
      skippedAt={t.wizard_skipped_at}
      activeStep={t.wizard_active_step}
      mode={t.wizard_mode}
      counts={{
        categories: categoriesCount ?? 0,
        items: itemsCount ?? 0,
        employees: employeesCount ?? 0,
        taxRates: taxRatesCount ?? 0,
        registers: registersCount ?? 0,
        tables: tablesCount ?? 0,
        stations: stationsCount ?? 0,
      }}
      stepStatus={stepStatus}
      moduleFlags={moduleFlags}
      moduleSubStatus={moduleSubStatus}
      hasCustomDomain={Boolean(t.custom_domain)}
      domainVerified={t.custom_domain_status === 'verified'}
    />
  );
}
