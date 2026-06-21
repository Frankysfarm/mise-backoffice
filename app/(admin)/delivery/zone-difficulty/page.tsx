import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { ZoneDifficultyClient } from './client';

export const dynamic = 'force-dynamic';

export default async function ZoneDifficultyPage() {
  await requireManagerPlus();
  const sb = await createClient();

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .maybeSingle();

  if (!emp?.location_id) redirect('/start');

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-black text-gray-900">Zonen-Schwierigkeit</h1>
        <p className="mt-1 text-sm text-gray-500">
          Dispatch-Modifikatoren basierend auf Fahrer-Feedback der letzten 14 Tage.
        </p>
      </div>
      <ZoneDifficultyClient />
    </div>
  );
}
