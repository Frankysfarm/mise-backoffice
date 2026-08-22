import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { BadgesEditor } from './editor';

export default async function BadgesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from('badges').select('*').order('punkte', { ascending: false });
  return (
    <div>
      <PageHeader title="Badges" description="Auszeichnungen für Mitarbeiter — mit Regel-JSON." />
      <BadgesEditor badges={data ?? []} />
    </div>
  );
}
