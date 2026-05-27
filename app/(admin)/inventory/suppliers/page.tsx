import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { SuppliersEditor } from './editor';

export default async function SuppliersPage() {
  await requireManagerPlus();
  const supabase = await createClient();
  const { data } = await supabase.from('suppliers').select('*').order('name');
  return (
    <div>
      <PageHeader backHref="/inventory" title="Lieferanten" description="Kontakte, Lieferkonditionen, Kundennummern." />
      <SuppliersEditor suppliers={(data ?? []) as any[]} />
    </div>
  );
}
