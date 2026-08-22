import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';
import { MenuView } from './client';
export const dynamic = 'force-dynamic';
export default async function MenuPage() {
  const emp = await getCurrentEmployee();
  const supabase = createServiceClient();
  const locId = emp?.location_id ?? '';
  const [{ data: cats }, { data: items }] = await Promise.all([
    supabase.from('menu_categories').select('id, name, aktiv, sort_order').eq('location_id', locId).order('sort_order', { ascending: true }),
    supabase.from('menu_items').select('id, name, beschreibung, preis, mwst_satz, verfuegbar, beliebt, category_id, sort_order, option_groups').eq('location_id', locId).order('sort_order', { ascending: true }),
  ]);
  return (
    <div style={{ maxWidth: 1180 }}>
      <MenuView cats={(cats ?? []) as any[]} items={(items ?? []) as any[]} />
    </div>
  );
}
