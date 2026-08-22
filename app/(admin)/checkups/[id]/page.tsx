import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { notFound } from 'next/navigation';
import { TemplateEditor } from './editor';

export default async function CheckupTemplateDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireManagerPlus();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: tpl }, { data: deps }] = await Promise.all([
    supabase.from('checkup_templates').select('*').eq('id', id).maybeSingle(),
    supabase.from('departments').select('id,name').order('name'),
  ]);
  if (!tpl) notFound();
  return (
    <div>
      <PageHeader backHref="/checkups" title={tpl.titel} description="Aufgaben-Liste als JSON bearbeiten." />
      <TemplateEditor tpl={tpl} departments={deps ?? []} />
    </div>
  );
}
