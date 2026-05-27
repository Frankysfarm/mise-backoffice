import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PhotoGallery, type Photo } from '@/components/photo-gallery';
import { AutoSubmitSelect } from '@/components/auto-submit-select';
import { signUrls } from '@/lib/storage';
import { dateTimeDE } from '@/lib/utils';

export default async function CleaningPhotosPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireManagerPlus();
  const params = await searchParams;
  const days = Number(params.days ?? '7');
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const supabase = await createClient();
  const { data: compsRaw } = await supabase.from('cleaning_completions')
    .select('id,erledigt_am,foto_url,employee:employees!cleaning_completions_employee_id_fkey(vorname,nachname),task:cleaning_tasks(titel,zone:cleaning_zones(name,icon))')
    .not('foto_url', 'is', null)
    .gte('erledigt_am', since)
    .order('erledigt_am', { ascending: false })
    .limit(120);

  const comps = compsRaw ?? [];
  const signed = await signUrls('cleaning-photos', comps.map(c => c.foto_url));

  const photos: Photo[] = comps
    .filter(c => c.foto_url && signed.get(c.foto_url as string))
    .map(c => ({
      id: c.id,
      url: signed.get(c.foto_url as string)!,
      caption: `${(c.task as any)?.zone?.icon ?? ''} ${(c.task as any)?.titel ?? '—'}`,
      subcaption: `${(c.employee as any)?.vorname ?? ''} ${(c.employee as any)?.nachname ?? ''} · ${dateTimeDE(c.erledigt_am)}`,
    }));

  return (
    <div>
      <PageHeader
        backHref="/cleaning"
        title="Reinigungs-Fotos"
        description={`Letzte ${days} Tage — ${photos.length} Foto-Nachweise.`}
        actions={<form className="flex items-center gap-2 text-sm">
          <label>Zeitraum:</label>
          <AutoSubmitSelect
            name="days"
            defaultValue={String(days)}
            options={[
              { value: '1', label: 'Heute' },
              { value: '3', label: '3 Tage' },
              { value: '7', label: '1 Woche' },
              { value: '30', label: '1 Monat' },
            ]}
          />
        </form>}
      />
      <Card>
        <CardContent className="p-4">
          {comps.filter(c => c.foto_url && !signed.get(c.foto_url as string)).length > 0 && (
            <Badge variant="muted" className="mb-3">
              {comps.filter(c => c.foto_url && !signed.get(c.foto_url as string)).length} Fotos konnten nicht signiert werden
            </Badge>
          )}
          <PhotoGallery photos={photos} emptyLabel="Keine Foto-Nachweise im Zeitraum." />
        </CardContent>
      </Card>
    </div>
  );
}
