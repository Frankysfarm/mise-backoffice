import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { TemplatesManager } from './manager';
import { WeekTemplateManager } from './week-template-manager';
import { operationsBasePath } from '@/lib/routing/operations-base-path';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  await requireManagerPlus();
  const basePath = await operationsBasePath('/schedule', '/neo/app/dienstplan');
  const supabase = await createClient();

  const [{ data: templates }, { data: departments }, { data: locations }, { data: weekTemplates }] = await Promise.all([
    supabase.from('shift_templates')
      .select('id,name,position,zeit_von,zeit_bis,pause_minuten,typ,department_id,location_id,farbe,sort_order')
      .order('sort_order'),
    supabase.from('departments').select('id,name').order('name'),
    supabase.from('locations').select('id,name').order('name'),
    supabase.from('schedule_templates').select('id,name,description,location_id,slots:schedule_template_slots(weekday,name,department_id,position,start_time,end_time,pause_minutes,headcount,sort_order)').order('name'),
  ]);

  return (
    <div>
      <PageHeader
        backHref={basePath}
        title="Schicht-Vorlagen"
        description="Typische Schichten vordefinieren und per 1-Klick einfügen."
      />
      <WeekTemplateManager templates={(weekTemplates ?? []) as never[]} departments={departments ?? []} locations={locations ?? []} />
      <h2 className="mb-2 mt-8 text-lg font-semibold">Einzelne Schichtbausteine</h2>
      <Card>
        <TemplatesManager
          initialTemplates={(templates ?? []) as any}
          departments={departments ?? []}
          locations={locations ?? []}
        />
      </Card>
      {(templates?.length ?? 0) === 0 && (
        <EmptyState
          title="Noch keine Vorlagen"
          description='Lege typische Schichten an — z.B. "Früh Barista 7–13", "Spät Küche 14–22". Im Dienstplan werden sie als Vorschläge angezeigt.'
        />
      )}
    </div>
  );
}
