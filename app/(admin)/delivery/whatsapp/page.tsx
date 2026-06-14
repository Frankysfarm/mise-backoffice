import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { WhatsAppClient } from './client';

export const dynamic = 'force-dynamic';

export default async function WhatsAppPage() {
  const employee = await requireManagerPlus().catch(() => redirect('/start'));
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.location_id) redirect('/start');

  return (
    <>
      <PageHeader
        title="WhatsApp-Benachrichtigungen"
        description="Automatische Bestell-Status-Updates via WhatsApp Business API · Meta Cloud API oder Twilio"
        backHref="/delivery"
      />
      <WhatsAppClient locationId={emp.location_id} />
    </>
  );
}
