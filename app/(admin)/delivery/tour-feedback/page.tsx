import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { TourFeedbackClient } from './client';
import { getFeedbackDashboard } from '@/lib/delivery/tour-feedback';

export const dynamic = 'force-dynamic';

export default async function TourFeedbackPage() {
  await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .maybeSingle();

  if (!emp?.location_id) redirect('/start');

  const dashboard = await getFeedbackDashboard(emp.location_id, 30).catch(() => null);

  return (
    <TourFeedbackClient
      locationId={emp.location_id}
      initial={dashboard}
    />
  );
}
