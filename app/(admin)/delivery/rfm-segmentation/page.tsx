import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { RfmSegmentationClient } from './client';

export const dynamic = 'force-dynamic';

export default async function RfmSegmentationPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('tenant_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.tenant_id) redirect('/start');

  return (
    <>
      <PageHeader
        title="Kunden-Segmentierung (RFM)"
        description="Recency · Frequency · Monetary — 10 Segmente · Zielgruppen für Push-Kampagnen"
      />
      <RfmSegmentationClient locationId={emp.tenant_id as string} />
    </>
  );
}
