import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createServiceClient } from '@/lib/supabase/server';
import { OperationsClient } from './operations-client';

export const dynamic = 'force-dynamic';

export default async function OperationsPage({ searchParams }: { searchParams: Promise<{ location?: string; from?: string; to?: string }> }) {
  const actor = await requireManagerPlus();
  if (!actor.tenant_id) redirect('/start');
  const params = await searchParams;
  const service = createServiceClient();
  let locationQuery = service.from('locations').select('id,name').eq('tenant_id', actor.tenant_id);
  if (!['backoffice','admin'].includes(actor.rolle)) locationQuery = locationQuery.eq('id', actor.location_id!);
  const { data: locations } = await locationQuery.order('name');
  const locationId = locations?.some((item) => item.id === params.location) ? params.location! : actor.location_id ?? locations?.[0]?.id;
  if (!locationId) redirect('/start');
  const from = /^\d{4}-\d{2}-\d{2}$/.test(params.from ?? '') ? `${params.from}T00:00:00+02:00` : new Date(Date.now()-30*86_400_000).toISOString();
  const to = /^\d{4}-\d{2}-\d{2}$/.test(params.to ?? '') ? `${params.to}T23:59:59+02:00` : new Date(Date.now()+86_400_000).toISOString();
  const [{ data: employees }, { data: departments }, { data: rules }, { data: tasks }, { data: handovers }] = await Promise.all([
    service.from('employees').select('id,vorname,nachname,rolle').eq('tenant_id', actor.tenant_id).eq('location_id', locationId).in('status',['aktiv','in_training','in_probe']).order('nachname'),
    service.from('departments').select('id,name').eq('tenant_id', actor.tenant_id).eq('location_id', locationId).eq('aktiv',true).order('name'),
    service.from('operational_task_templates').select('id,title,description,department_id,recurrence_rule,target_type,target_role,assigned_employee_id,priority,aktiv,paused_at,created_at').eq('tenant_id', actor.tenant_id).eq('location_id', locationId).is('deleted_at',null).order('created_at',{ascending:false}),
    service.from('operational_tasks').select('id,title,status,due_at,assigned_to,department_id,completed_at,assigned:employees!operational_tasks_assigned_to_fkey(vorname,nachname)').eq('tenant_id',actor.tenant_id).eq('location_id',locationId).not('status','in','(erledigt,storniert)').order('due_at').limit(200),
    service.from('responsibility_handovers').select('id,department_id,from_employee_id,to_employee_id,created_at,read_at,read_by,confirmed_at,confirmed_by,status,open_task_ids,incidents,inventory_notes,damage_notes,cleaning_notes,important_notes,evidence,from_employee:employees!responsibility_handovers_from_employee_id_fkey(vorname,nachname),to_employee:employees!responsibility_handovers_to_employee_id_fkey(vorname,nachname)').eq('tenant_id',actor.tenant_id).eq('location_id',locationId).gte('created_at',from).lte('created_at',to).order('created_at',{ascending:false}).limit(300),
  ]);
  return <OperationsClient actorId={actor.id} locationId={locationId} locations={locations ?? []} employees={(employees ?? []) as never[]} departments={departments ?? []} rules={(rules ?? []) as never[]} tasks={(tasks ?? []) as never[]} handovers={(handovers ?? []) as never[]} />;
}
