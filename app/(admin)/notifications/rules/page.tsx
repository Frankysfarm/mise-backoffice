import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { RulesEditor } from './editor';

export default async function NotificationRulesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from('notification_rules')
    .select('*').order('event_type');
  return (
    <div>
      <PageHeader
        backHref="/notifications"
        title="Benachrichtigungs-Regeln"
        description="Wer wird bei welchem Event wie informiert. Edge-Functions lesen diese Regeln."
      />
      <RulesEditor rules={data ?? []} />
    </div>
  );
}
