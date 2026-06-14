import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { ReferralProgramClient } from './client';

export const dynamic = 'force-dynamic';

export default async function ReferralProgramPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.location_id) redirect('/start');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empfehlungs-Programm"
        description="Kunden werben Kunden — automatische Belohnungen via Gutscheine"
      />
      <ReferralProgramClient locationId={emp.location_id as string} />
    </div>
  );
}
