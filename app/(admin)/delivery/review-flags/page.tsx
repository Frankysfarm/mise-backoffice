import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { ReviewFlagsClient } from './client';
import { getFlagStats, getOpenFlags } from '@/lib/delivery/review-flags';

export const dynamic = 'force-dynamic';

export default async function ReviewFlagsPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('id', employee.id)
    .maybeSingle();

  if (!emp?.location_id) redirect('/start');

  const locationId = emp.location_id as string;

  const [stats, flags] = await Promise.all([
    getFlagStats(locationId).catch(() => null),
    getOpenFlags(locationId, true).catch(() => []),
  ]);

  // Drivers for manual flag creation
  const svc = createServiceClient();
  const { data: drivers } = await svc
    .from('mise_drivers')
    .select('id, name')
    .eq('active', true)
    .order('name');

  return (
    <ReviewFlagsClient
      locationId={locationId}
      initialStats={stats}
      initialFlags={flags}
      drivers={(drivers ?? []) as { id: string; name: string }[]}
    />
  );
}
