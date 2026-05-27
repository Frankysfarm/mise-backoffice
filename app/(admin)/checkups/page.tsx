import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { dateTimeDE } from '@/lib/utils';

export default async function CheckupsPage() {
  await requireManagerPlus();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: templates }, { data: sessions }] = await Promise.all([
    supabase.from('checkup_templates')
      .select('id,titel,phase,position_typ,intervall,aktiv,fragen,auto_reminder_minutes,department:departments(name)')
      .order('titel'),
    supabase.from('checkup_sessions')
      .select('id,template_id,datum,phase,completed_at,started_at,template:checkup_templates(titel),started_by_emp:employees!checkup_sessions_started_by_fkey(vorname,nachname)')
      .eq('datum', today)
      .order('started_at', { ascending: false }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader title="Check-ups" description="Tägliche Foto-Kontrollen: Templates und heutige Durchläufe." />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Heutige Check-ups ({today})</h2>
        </div>
        <Card>
          {(sessions?.length ?? 0) === 0 ? (
            <CardContent className="p-6 text-sm text-muted-foreground">Heute noch kein Check-up gestartet.</CardContent>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Template</TableHead><TableHead>Phase</TableHead>
                <TableHead>Gestartet von</TableHead><TableHead>Start</TableHead>
                <TableHead>Abgeschlossen</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {sessions!.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <Link href={`/checkups/sessions/${s.id}`} className="hover:underline">
                        {(s.template as any)?.titel}
                      </Link>
                    </TableCell>
                    <TableCell>{s.phase}</TableCell>
                    <TableCell>{(s.started_by_emp as any)?.vorname} {(s.started_by_emp as any)?.nachname}</TableCell>
                    <TableCell>{dateTimeDE(s.started_at)}</TableCell>
                    <TableCell>{s.completed_at ? <Badge variant="secondary">✓ {dateTimeDE(s.completed_at)}</Badge> : <Badge variant="gold">läuft</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Templates ({templates?.length ?? 0})</h2>
        </div>
        <Card>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Titel</TableHead>
              <TableHead>Phase</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Abteilung</TableHead>
              <TableHead className="text-right">Aufgaben</TableHead>
              <TableHead>Aktiv</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {templates?.map(t => {
                const tasks = Array.isArray((t.fragen as any)?.tasks) ? (t.fragen as any).tasks.length : 0;
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      <Link href={`/checkups/${t.id}`} className="hover:underline">{t.titel}</Link>
                    </TableCell>
                    <TableCell>{t.phase ?? '—'}</TableCell>
                    <TableCell>{t.position_typ ?? '—'}</TableCell>
                    <TableCell>{(t.department as any)?.name ?? '—'}</TableCell>
                    <TableCell className="text-right font-mono">{tasks}</TableCell>
                    <TableCell>{t.aktiv ? '✓' : '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  );
}
