import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requirePosAccess } from '@/lib/auth/requireRole';
import { OrderInboxClient } from './client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bestelleingang · Mise' };

export default async function InboxPage() {
  const emp = await requirePosAccess();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb
    .from('employees')
    .select('tenant_id,location_id')
    .eq('id', emp.id)
    .maybeSingle();
  if (!empRow?.tenant_id || !empRow.location_id) redirect('/start');

  const [{ data: tenant }, { data: location }, { data: orders }, { data: drivers }] = await Promise.all([
    svc.from('tenants').select('name, slug, stripe_connect_charges_enabled').eq('id', empRow.tenant_id).single(),
    svc.from('locations').select('name').eq('id', empRow.location_id).single(),
    svc.from('customer_orders')
      .select('id, bestellnummer, typ, status, kunde_name, kunde_telefon, kunde_adresse, kunde_plz, kunde_stadt, kunde_notiz, gesamtbetrag, bestellt_am, bestaetigt_am, zubereitung_start, fertig_am, fahrer_id, geschaetzte_lieferung_min, eta, order_items(id, name, menge, einzelpreis, extras, notiz)')
      .eq('location_id', empRow.location_id)
      .in('status', ['neu', 'bestätigt', 'in_zubereitung', 'fertig', 'unterwegs'])
      .order('bestellt_am', { ascending: false })
      .limit(50),
    svc.from('employees')
      .select('id, vorname, nachname, fahrzeug_praeferenz, driver_status(ist_online, fahrzeug, aktueller_batch_id, last_update)')
      .eq('tenant_id', empRow.tenant_id)
      .eq('kann_ausliefern', true)
      .eq('status', 'aktiv'),
  ]);

  const t = tenant as { name: string; slug: string; stripe_connect_charges_enabled: boolean | null };

  return (
    <OrderInboxClient
      tenantName={t.name}
      tenantSlug={t.slug}
      locationId={empRow.location_id}
      locationName={(location as { name: string }).name}
      stripeReady={Boolean(t.stripe_connect_charges_enabled)}
      initialOrders={(orders ?? []) as never[]}
      drivers={(drivers ?? []) as never[]}
    />
  );
}
