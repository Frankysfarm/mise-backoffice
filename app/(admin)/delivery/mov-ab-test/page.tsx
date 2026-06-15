import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { MovAbTestClient } from './client';

export const dynamic = 'force-dynamic';

export default async function MovAbTestPage() {
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
        title="MOV A/B-Test"
        description="Mindestbestellwert-Experimente je Zone (A/B/C/D) und Tageszeit — Konversionsrate und Ø-Bestellwert im Variantenvergleich"
        backHref="/delivery"
      />
      <MovAbTestClient locationId={emp.tenant_id as string} />
    </>
  );
}
