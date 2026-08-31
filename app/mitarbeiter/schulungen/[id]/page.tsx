import { notFound } from 'next/navigation';
import { requirePosAccess } from '@/lib/auth/requireRole';
import { createServiceClient } from '@/lib/supabase/server';
import { TrainingRunner } from './runner';
export default async function TrainingPage({ params }: { params: Promise<{ id: string }> }) { const employee = await requirePosAccess(); const { id } = await params; if (!employee.tenant_id) notFound(); const { data } = await createServiceClient().from('training_progress').select('id,status,module:training_modules(titel,beschreibung,inhalt,passing_threshold)').eq('id', id).eq('employee_id', employee.id).eq('tenant_id', employee.tenant_id).maybeSingle(); if (!data) notFound(); return <main className="mx-auto max-w-3xl px-4 py-6"><TrainingRunner progress={data as any} /></main>; }
