import { createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { notFound } from 'next/navigation';
import { ModuleEditor } from './editor';
import { operationsBasePath } from '@/lib/routing/operations-base-path';

export default async function TrainingDetail({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireManagerPlus();
  if (!actor.tenant_id) throw new Error('Betrieb fehlt.');
  const basePath = await operationsBasePath('/training', '/neo/app/schulungen');
  const { id } = await params;
  const supabase = createServiceClient();
  const { data } = await supabase.from('training_modules').select('*').eq('id', id).eq('tenant_id', actor.tenant_id).maybeSingle();
  if (!data) notFound();

  const [{ data: progress }, { data: targets }, { data: quizKeys }, { data: locations }, { data: departments }, { data: employees }] = await Promise.all([
    supabase.from('training_progress').select('id,status,due_at,fortschritt_prozent,abgeschlossen,testergebnis,employee:employees!training_progress_employee_id_fkey(vorname,nachname)').eq('module_id', id),
    supabase.from('training_module_targets').select('*').eq('module_id', id),
    supabase.from('training_quiz_keys').select('*').eq('module_id', id),
    supabase.from('locations').select('id,name').eq('tenant_id', actor.tenant_id).order('name'),
    supabase.from('departments').select('id,name').eq('tenant_id', actor.tenant_id).order('name'),
    supabase.from('employees').select('id,vorname,nachname').eq('tenant_id', actor.tenant_id).in('status', ['aktiv', 'in_training']).order('nachname'),
  ]);

  return (
    <div>
      <PageHeader backHref={basePath} title={data.titel} description="Inhalte visuell aufbauen, Zielgruppen festlegen und Fortschritt verfolgen." />
      <ModuleEditor mod={data} progress={progress ?? []} targets={targets ?? []} quizKeys={quizKeys ?? []} locations={locations ?? []} departments={departments ?? []} employees={employees ?? []} />
    </div>
  );
}
