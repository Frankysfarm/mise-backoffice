import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { SmartUpsellClient } from './client';

export const dynamic = 'force-dynamic';

export default async function SmartUpsellPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.location_id) redirect('/start');

  return (
    <div className="space-y-4">
      <PageHeader
        title="Smart Upsells"
        description="Market-Basket-Analyse: häufig zusammen bestellte Artikel automatisch als Upsell vorschlagen — steigert den Bestellwert"
        backHref="/delivery"
      />
      <SmartUpsellClient locationId={emp.location_id as string} />
    </div>
  );
}
