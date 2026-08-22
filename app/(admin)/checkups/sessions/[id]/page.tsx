import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PhotoGallery, type Photo } from '@/components/photo-gallery';
import { signUrls } from '@/lib/storage';
import { dateTimeDE } from '@/lib/utils';
import { notFound } from 'next/navigation';

export default async function CheckupSessionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireManagerPlus();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: session }, { data: completions }] = await Promise.all([
    supabase.from('checkup_sessions')
      .select('*,template:checkup_templates(titel,fragen),started_by_emp:employees!checkup_sessions_started_by_fkey(vorname,nachname),location:locations(name)')
      .eq('id', id).maybeSingle(),
    supabase.from('checkup_completions')
      .select('id,task_id,foto_url,antwort,created_at,employee:employees!checkup_completions_employee_id_fkey(vorname,nachname)')
      .eq('session_id', id).order('created_at'),
  ]);
  if (!session) notFound();

  const tasks: any[] = Array.isArray((session.template as any)?.fragen?.tasks)
    ? (session.template as any).fragen.tasks
    : [];

  const signed = await signUrls('checkup-photos', (completions ?? []).map(c => c.foto_url));

  const photos: Photo[] = (completions ?? [])
    .filter(c => c.foto_url && signed.get(c.foto_url as string))
    .map(c => {
      const task = tasks.find(t => t.id === c.task_id);
      const url = signed.get(c.foto_url as string)!;
      return {
        id: c.id,
        url,
        caption: task?.title ?? c.task_id,
        subcaption: `${(c.employee as any)?.vorname ?? ''} ${(c.employee as any)?.nachname ?? ''} · ${dateTimeDE(c.created_at)}`,
      };
    });

  const erledigteTaskIds = new Set((completions ?? []).map(c => c.task_id));
  const nichtErledigt = tasks.filter(t => !erledigteTaskIds.has(t.id));

  return (
    <div>
      <PageHeader
        backHref="/checkups"
        title={`Check-up: ${(session.template as any)?.titel ?? 'Session'}`}
        description={`${session.datum} · ${session.phase ?? ''} · Start ${dateTimeDE(session.started_at)}${session.completed_at ? ` · Fertig ${dateTimeDE(session.completed_at)}` : ' · läuft'}`}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Badge variant="secondary">{tasks.length} Aufgaben</Badge>
        <Badge variant="muted">{erledigteTaskIds.size} erledigt</Badge>
        {nichtErledigt.length > 0 && <Badge variant="destructive">{nichtErledigt.length} offen</Badge>}
        <Badge>Gestartet von: {(session.started_by_emp as any)?.vorname} {(session.started_by_emp as any)?.nachname}</Badge>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <h3 className="mb-3 font-display font-semibold">Fotos ({photos.length})</h3>
          <PhotoGallery photos={photos} emptyLabel="Keine Fotos hochgeladen." />
        </CardContent>
      </Card>

      {nichtErledigt.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 font-display font-semibold text-destructive">
              Noch offen ({nichtErledigt.length})
            </h3>
            <ul className="space-y-2">
              {nichtErledigt.map((t: any) => (
                <li key={t.id} className="rounded border border-dashed p-3 text-sm">
                  <div className="font-medium">{t.title}</div>
                  {t.description && <div className="mt-1 text-muted-foreground">{t.description}</div>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
