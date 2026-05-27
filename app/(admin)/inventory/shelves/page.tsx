import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { ShelvesEditor } from './editor';

export default async function ShelvesPage() {
  await requireManagerPlus();
  const supabase = await createClient();
  const [{ data: shelves }, { data: areas }] = await Promise.all([
    supabase.from('inventory_shelves').select('*,area:inventory_areas(name)').order('area_id').order('position'),
    supabase.from('inventory_areas').select('id,name').order('name'),
  ]);
  return (
    <div>
      <PageHeader backHref="/inventory" title="Fächer & Regalplätze"
        description="Physische Plätze in jedem Lagerbereich. Inventur + Wareneingang orientieren sich an der Reihenfolge." />
      <ShelvesEditor shelves={(shelves ?? []) as any[]} areas={areas ?? []} />
    </div>
  );
}
