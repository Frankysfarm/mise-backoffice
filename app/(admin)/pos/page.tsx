import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { POSTerminal } from './terminal';

export default async function POSPage() {
  await requireManagerPlus();
  const supabase = await createClient();

  const [{ data: registers }, { data: categories }, { data: items }, { data: taxRates }] = await Promise.all([
    supabase.from('pos_registers').select('*').eq('aktiv', true),
    supabase.from('menu_categories').select('*').eq('aktiv', true).order('sort_order'),
    supabase.from('menu_items').select('*').eq('verfuegbar', true).order('sort_order'),
    supabase.from('tax_rates').select('*').eq('aktiv', true),
  ]);

  return (
    <POSTerminal
      registers={(registers ?? []) as any[]}
      categories={(categories ?? []) as any[]}
      items={(items ?? []) as any[]}
      taxRates={(taxRates ?? []) as any[]}
    />
  );
}
