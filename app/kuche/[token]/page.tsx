import { createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import KitchenMonitor from './client';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const svc = createServiceClient();
  const { data: loc } = await svc
    .from('locations')
    .select('id, tenant_id, name')
    .eq('kitchen_token', token)
    .maybeSingle();
  if (!loc) notFound();

  const [{ data: orders }, { data: items }] = await Promise.all([
    svc.from('customer_orders')
      .select('id, bestellnummer, status, kunde_name, kunde_telefon, kunde_adresse, typ, gesamtbetrag, fertig_am, created_at, items:order_items(id, name, menge, notiz)')
      .eq('location_id', loc.id)
      .in('status', ['neu', 'bestätigt', 'in_zubereitung', 'fertig'])
      .order('created_at', { ascending: true }),
    svc.from('menu_items')
      .select('id, name, verfuegbar')
      .eq('tenant_id', loc.tenant_id)
      .order('name')
      .limit(200),
  ]);

  return (
    <KitchenMonitor
      token={token}
      shopName={loc.name}
      initialOrders={(orders ?? []) as any}
      initialItems={(items ?? []) as any}
    />
  );
}
