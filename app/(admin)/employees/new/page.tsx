import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { NewEmployeeForm } from './form';

export default async function NewEmployeePage() {
  const currentEmployee = await requireAdmin();
  if (!currentEmployee.tenant_id) throw new Error('Mitarbeiterkonto ist keinem Mandanten zugeordnet.');
  const supabase = await createClient();
  const [{ data: locations }, { data: departments }] = await Promise.all([
    supabase.from('locations').select('id,name').eq('tenant_id', currentEmployee.tenant_id).order('name'),
    supabase
      .from('departments')
      .select('id,name,location:locations!inner(tenant_id)')
      .eq('location.tenant_id', currentEmployee.tenant_id)
      .order('name'),
  ]);
  return (
    <div>
      <PageHeader backHref="/employees" title="Neuen Mitarbeiter anlegen" description="Stammdaten — Einladung per E-Mail erfolgt separat." />
      <NewEmployeeForm
        tenantId={currentEmployee.tenant_id}
        locations={locations ?? []}
        departments={(departments ?? []).map(({ id, name }) => ({ id, name }))}
      />
    </div>
  );
}
