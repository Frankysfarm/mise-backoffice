import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { SuppliersEditor } from './editor';
import { operationsBasePath } from '@/lib/routing/operations-base-path';

export default async function SuppliersPage() {
  await requireManagerPlus();
  const basePath = await operationsBasePath('/inventory', '/neo/app/lager');
  const supabase = await createClient();
  const { data } = await supabase.from('suppliers').select('*').order('name');
  return (
    <div>
      <PageHeader backHref={basePath} title="Lieferanten" description="Kontakte, Lieferkonditionen, Kundennummern." />
      <SuppliersEditor suppliers={(data ?? []) as any[]} />
    </div>
  );
}
