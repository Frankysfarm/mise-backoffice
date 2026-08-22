import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { DepartmentsEditor } from './editor';

export default async function DepartmentsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: deps }, { data: locs }] = await Promise.all([
    supabase.from('departments').select('id,name,farbe,location_id').order('name'),
    supabase.from('locations').select('id,name').order('name'),
  ]);
  return (
    <div>
      <PageHeader title="Abteilungen" description="Bar, Küche, Service — pro Standort gruppiert." />
      <DepartmentsEditor departments={deps ?? []} locations={locs ?? []} />
    </div>
  );
}
