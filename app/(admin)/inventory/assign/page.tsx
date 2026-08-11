import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { AssignForm } from './form';
import { operationsBasePath } from '@/lib/routing/operations-base-path';

export default async function AssignInventoryPage() {
  await requireManagerPlus();
  const basePath = await operationsBasePath('/inventory', '/neo/app/lager');
  const supabase = await createClient();
  const [{ data: areas }, { data: employees }, { data: locs }] = await Promise.all([
    supabase.from('inventory_areas').select('id,name,location_id,location:locations(name)').order('name'),
    supabase.from('employees').select('id,vorname,nachname').in('status', ['aktiv', 'in_probe']).order('nachname'),
    supabase.from('locations').select('id,name').order('name'),
  ]);
  return (
    <div>
      <PageHeader backHref={basePath} title="Inventur zuweisen" description="Wähle Bereich, Mitarbeiter und optional Schicht." />
      <AssignForm areas={(areas ?? []) as any[]} employees={employees ?? []} locations={(locs ?? []) as any[]} successPath={`${basePath}/sessions`} />
    </div>
  );
}
