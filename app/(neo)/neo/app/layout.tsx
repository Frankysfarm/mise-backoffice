import Shell from './shell';
import { redirect } from 'next/navigation';
import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';
const FONTS = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';
export default async function NeoAppLayout({ children }: { children: React.ReactNode }) {
  const emp = await getCurrentEmployee();
  if (!emp?.tenant_id) redirect('/start');
  const supabase = createServiceClient();
  const [{ count }, { data: t }] = await Promise.all([
    supabase.from('customer_orders').select('id', { count: 'exact', head: true }).eq('location_id', emp?.location_id ?? '').eq('status', 'neu'),
    supabase.from('tenants').select('name, slug, wizard_completed_at, wizard_skipped_at').eq('id', emp?.tenant_id ?? '').maybeSingle(),
  ]);
  // Onboarding-Guard (wie altes Dashboard): neuer Tenant ohne abgeschlossenen Wizard → Setup
  if (t && !t.wizard_completed_at && !t.wizard_skipped_at) redirect('/setup-wizard');
  const shopUrl = t?.slug ? `https://mise-gastro.de/biss-app/${t.slug}` : '#';
  return (<><link href={FONTS} rel="stylesheet" /><Shell newCount={count ?? 0} tenantName={t?.name ?? 'Mein Shop'} shopUrl={shopUrl}>{children}</Shell></>);
}
