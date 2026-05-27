import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { PRESETS, findPreset, STEP_CONFIG, buildCustomPreset } from '@/lib/setup-presets';
import { SetupWizard } from './client';

export const dynamic = 'force-dynamic';

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; modules?: string }>;
}) {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empT } = await sb.from('employees').select('tenant_id').eq('id', emp.id).maybeSingle();
  if (!empT?.tenant_id) redirect('/start');

  const sp = await searchParams;
  let preset = sp.preset ? findPreset(sp.preset) : null;

  // Custom-Preset aus Einzelmodul-Liste
  if (!preset && sp.modules) {
    const ids = sp.modules.split(',').filter(Boolean);
    if (ids.length > 0) preset = buildCustomPreset(ids);
  }

  // Tenant-Daten für Step-Checks
  const { data: tenant } = await svc
    .from('tenants')
    .select('id,name,slug,ustid,stripe_connect_charges_enabled,lieferradius_km,storefront_theme_id,resend_verified_at')
    .eq('id', empT.tenant_id)
    .single();

  // Zähle Menü-Items + Fahrer + Mitarbeiter + Voucher
  const [{ count: itemCount }, { count: driverCount }, { count: empCount }, { count: voucherCount }] = await Promise.all([
    svc.from('menu_items').select('id', { count: 'exact', head: true }),
    svc.from('employees').select('id', { count: 'exact', head: true }).eq('tenant_id', empT.tenant_id).eq('kann_ausliefern', true),
    svc.from('employees').select('id', { count: 'exact', head: true }).eq('tenant_id', empT.tenant_id).eq('status', 'aktiv'),
    svc.from('vouchers').select('id', { count: 'exact', head: true }).eq('tenant_id', empT.tenant_id),
  ]);

  // Pro Step: erfüllt oder nicht?
  const counts = { menu: itemCount ?? 0, fahrer: driverCount ?? 0, employees: empCount ?? 0, voucher: voucherCount ?? 0 };
  const stepStatus: Record<string, boolean> = {
    restaurant_basis: !!tenant?.ustid,
    stripe: !!tenant?.stripe_connect_charges_enabled,
    lieferung: !!tenant?.lieferradius_km && Number(tenant.lieferradius_km) > 0,
    theme: !!tenant?.storefront_theme_id,
    menue: counts.menu > 0,
    email: !!tenant?.resend_verified_at,
    zahlungen: false, // manuell bestätigen
    plattformen: false, // manuell bestätigen
    fahrer: counts.fahrer > 0,
    mitarbeiter: counts.employees > 1,
    kasse: false, // manuell
    gutscheine: counts.voucher > 0,
  };

  return (
    <>
      <PageHeader
        title={preset ? `Setup: ${preset.name}` : 'Einrichtungsassistent'}
        description={preset ? preset.description : 'Wähle einen Use-Case — wir zeigen dir genau die Schritte, die du brauchst.'}
        backHref={preset ? '/setup' : '/'}
      />
      <SetupWizard
        preset={preset}
        presets={PRESETS}
        stepConfig={STEP_CONFIG}
        stepStatus={stepStatus}
        tenantSlug={tenant?.slug ?? ''}
      />
    </>
  );
}
