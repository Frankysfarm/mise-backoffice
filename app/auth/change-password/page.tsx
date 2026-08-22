import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { ChangePasswordForm } from './form';

export const dynamic = 'force-dynamic';

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const svc = createServiceClient();
  const { data: emp } = await svc.from('employees').select('vorname, muss_passwort_aendern').eq('auth_user_id', user.id).maybeSingle();

  const sp = await searchParams;
  const next = sp.next ?? '/';

  return <ChangePasswordForm vorname={emp?.vorname ?? ''} forced={!!emp?.muss_passwort_aendern} next={next} />;
}
