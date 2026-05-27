import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { dateTimeDE } from '@/lib/utils';
import { Image as ImageIcon } from 'lucide-react';

export default async function CleaningPage() {
  await requireManagerPlus();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: zones }, { data: tasksRaw }, { data: compsTodayRaw }] = await Promise.all([
    supabase.from('cleaning_zones').select('id,name,icon,farbe,recommended_order,beschreibung,aktiv,location:locations(name)').order('recommended_order'),
    supabase.from('cleaning_tasks').select('*').eq('aktiv', true),
    supabase.from('cleaning_completions').select('task_id,erledigt_am,employee:employees!cleaning_completions_employee_id_fkey(vorname,nachname),task:cleaning_tasks(titel,zone:cleaning_zones(name))').eq('completed_date', today).order('erledigt_am', { ascending: false }),
  ]);
  const tasks = tasksRaw as any[] | null;
  const compsToday = compsTodayRaw as any[] | null;

  const byZone = new Map<string, any[]>();
  (tasks ?? []).forEach((t: any) => {
    if (!byZone.has(t.zone_id)) byZone.set(t.zone_id, []);
    byZone.get(t.zone_id)!.push(t);
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reinigung"
        description="Zonen, Aufgaben pro Phase, heutige Erledigungen."
        actions={<>
          <Link href="/cleaning/plan"><Button variant="outline">📅 Reinigungsplan</Button></Link>
          <Link href={`/api/pdf/haccp?month=${new Date().toISOString().slice(0, 7)}`}><Button variant="outline">📄 HACCP</Button></Link>
          <Link href="/cleaning/photos"><Button variant="outline"><ImageIcon className="h-4 w-4" /> Fotos</Button></Link>
        </>}
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {zones?.map(z => {
          const zt = byZone.get(z.id) ?? [];
          const morning = zt.filter(t => t.phase === 'morning').length;
          const evening = zt.filter(t => t.phase === 'evening').length;
          const weekly = zt.filter(t => t.phase === 'weekly').length;
          return (
            <Card key={z.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">{z.icon}</span>
                  <span>{z.name}</span>
                </CardTitle>
                <Badge variant="muted">#{z.recommended_order}</Badge>
              </CardHeader>
              <CardContent>
                {z.beschreibung && <p className="mb-3 text-sm text-muted-foreground">{z.beschreibung}</p>}
                <div className="flex gap-2 text-xs">
                  <Badge variant="secondary">Morgens {morning}</Badge>
                  <Badge variant="gold">Abends {evening}</Badge>
                  <Badge variant="accent">Wöchentl. {weekly}</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Heute erledigt ({compsToday?.length ?? 0})</h2>
        <Card>
          {(compsToday?.length ?? 0) === 0 ? (
            <CardContent className="p-6 text-sm text-muted-foreground">Noch nichts erledigt heute.</CardContent>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Zeit</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Aufgabe</TableHead>
                <TableHead>Mitarbeiter:in</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {compsToday!.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{dateTimeDE(c.erledigt_am)}</TableCell>
                    <TableCell>{(c.task as any)?.zone?.name ?? '—'}</TableCell>
                    <TableCell className="font-medium">{(c.task as any)?.titel}</TableCell>
                    <TableCell>{(c.employee as any)?.vorname} {(c.employee as any)?.nachname}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </section>
    </div>
  );
}
