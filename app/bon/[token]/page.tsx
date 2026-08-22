import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { BonView } from './client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Kassenbeleg' };

export default async function BonPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const svc = createServiceClient();

  const { data: tx } = await svc
    .from('pos_transactions')
    .select('*')
    .eq('bon_token', token)
    .maybeSingle();

  if (!tx) notFound();

  const [{ data: tenant }, { data: location }, { data: customerOrder }, { data: bewirtung }] = await Promise.all([
    svc.from('tenants').select('name, logo_url, theme_primary, theme_accent, adresse, stadt, plz, telefon, email, steuernummer, ust_id').eq('id', tx.tenant_id).single(),
    svc.from('locations').select('name, adresse, stadt, plz, telefon').eq('id', tx.location_id).maybeSingle(),
    tx.customer_order_id
      ? svc.from('customer_orders')
        .select('bestellnummer, items:order_items(name, menge, einzelpreis, gesamtpreis, notiz)')
        .eq('id', tx.customer_order_id).maybeSingle()
      : Promise.resolve({ data: null }),
    svc.from('bewirtungsbelege').select('*').eq('transaction_id', tx.id).maybeSingle(),
  ]);

  return (
    <BonView
      transaction={tx as any}
      tenant={tenant as any}
      location={location as any}
      order={customerOrder as any}
      bewirtung={bewirtung as any}
    />
  );
}
