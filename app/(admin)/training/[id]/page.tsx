import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { notFound } from 'next/navigation';
import { ModuleEditor } from './editor';

export default async function TrainingDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireManagerPlus();
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('training_modules').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();

  const { data: progress } = await supabase.from('training_progress')
    .select('fortschritt_prozent,abgeschlossen,testergebnis,employee:employees!training_progress_employee_id_fkey(vorname,nachname)')
    .eq('module_id', id);

  return (
    <div>
      <PageHeader backHref="/training" title={data.titel} description="Lernkarten + Quizfragen als JSON bearbeiten." />
      <ModuleEditor mod={data} progress={progress ?? []} />
    </div>
  );
}
