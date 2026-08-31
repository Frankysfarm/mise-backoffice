import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { notFound } from 'next/navigation';
import { GuideEditor } from './editor';
import { operationsBasePath } from '@/lib/routing/operations-base-path';

export default async function GuideDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireManagerPlus();
  const basePath = await operationsBasePath('/shift-guides', '/neo/app/ablaeufe/schichtleitfaeden');
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: guide }, { data: deps }, { data: locations }] = await Promise.all([
    supabase.from('shift_guides').select('*').eq('id', id).maybeSingle(),
    supabase.from('departments').select('id,name').order('name'),
    supabase.from('locations').select('id,name').order('name'),
  ]);
  if (!guide) notFound();
  return (
    <div>
      <PageHeader backHref={basePath} title={guide.titel} description="Ablauf visuell aufbauen – so sieht ihn später das Team." />
      <GuideEditor guide={guide} departments={deps ?? []} locations={locations ?? []} basePath={basePath} />
    </div>
  );
}
