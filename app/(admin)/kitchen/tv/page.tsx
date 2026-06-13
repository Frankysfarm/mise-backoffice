import { createClient } from '@/lib/supabase/server';
import { KitchenTVDisplay } from './client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function KitchenTVPage() {
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from('customer_orders')
    .select('id, bestellnummer, status, typ, kunde_name, bestellt_am, fertig_am, geschaetzte_zubereitung_min, items:order_items(id, name, menge)')
    .in('status', ['bestätigt', 'in_zubereitung', 'fertig'])
    .order('bestellt_am', { ascending: true });

  const { data: timings } = await supabase
    .from('kitchen_timings')
    .select('id, order_id, cook_start_at, ready_target, prep_min, status')
    .in('status', ['scheduled', 'cooking'])
    .order('cook_start_at', { ascending: true });

  return (
    <KitchenTVDisplay
      initialOrders={(orders as any[]) ?? []}
      initialTimings={(timings as any[]) ?? []}
    />
  );
}
