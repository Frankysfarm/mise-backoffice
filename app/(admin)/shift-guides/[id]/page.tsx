import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { notFound } from 'next/navigation';
import { GuideEditor } from './editor';

export default async function GuideDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireManagerPlus();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: guide }, { data: deps }] = await Promise.all([
    supabase.from('shift_guides').select('*').eq('id', id).maybeSingle(),
    supabase.from('departments').select('id,name').order('name'),
  ]);
  if (!guide) notFound();
  return (
    <div>
      <PageHeader backHref="/shift-guides" title={guide.titel} description="Kategorien & Schritte als JSON bearbeiten." />
      <GuideEditor guide={guide} departments={deps ?? []} />
    </div>
  );
}
