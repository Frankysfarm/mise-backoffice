import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createServiceClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { AssessmentManager } from './assessment-manager';
import { operationsBasePath } from '@/lib/routing/operations-base-path';

export default async function AssessmentPage() {
  const actor = await requireManagerPlus();
  if (!actor.tenant_id) throw new Error('Mitarbeiterkonto ist keinem Betrieb zugeordnet.');
  const service = createServiceClient();
  const [{ data: templates }, { data: departments }, { data: locations }] = await Promise.all([
    (() => { const query = service.from('assessment_templates').select('id,name,description,status,location_id,updated_at').eq('tenant_id', actor.tenant_id).eq('category', 'APPLICATION'); return (actor.rolle === 'manager' ? query.or(actor.location_id ? `location_id.is.null,location_id.eq.${actor.location_id}` : 'location_id.is.null') : query).order('updated_at', { ascending: false }); })(),
    service.from('departments').select('id,name,location_id').eq('tenant_id', actor.tenant_id).order('name'),
    service.from('locations').select('id,name').eq('tenant_id', actor.tenant_id).order('name'),
  ]);
  const backHref = await operationsBasePath('/applications', '/neo/app/bewerbungen');
  return <div><PageHeader backHref={backHref} title="Bewerbungstests" description="Tests erstellen, Stellen zuordnen und Ergebnisse nachvollziehen." /><AssessmentManager initialTemplates={templates ?? []} departments={departments ?? []} locations={locations ?? []} isManager={actor.rolle === 'manager'} managerLocationId={actor.rolle === 'manager' ? actor.location_id : null} /></div>;
}
