import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { GeoDemandClient } from './client';

export const dynamic = 'force-dynamic';

export default async function GeoDemandPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('location_id, tenant_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.location_id) redirect('/start');

  return (
    <div className="space-y-4">
      <PageHeader
        title="Geo-Nachfrage & Zonen-Expansion"
        description="Bestelldichte nach PLZ — potenzielle Liefergebiete mit ROI-Schätzung identifizieren"
      />
      <GeoDemandClient locationId={emp.location_id as string} />
    </div>
  );
}
