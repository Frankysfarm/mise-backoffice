import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { NewEmployeeForm } from './form';

export default async function NewEmployeePage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: locations }, { data: departments }] = await Promise.all([
    supabase.from('locations').select('id,name').order('name'),
    supabase.from('departments').select('id,name').order('name'),
  ]);
  return (
    <div>
      <PageHeader backHref="/employees" title="Neuen Mitarbeiter anlegen" description="Stammdaten — Einladung per E-Mail erfolgt separat." />
      <NewEmployeeForm locations={locations ?? []} departments={departments ?? []} />
    </div>
  );
}
