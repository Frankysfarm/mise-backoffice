import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty';
import { dateDE } from '@/lib/utils';
import { AssignCleaningForm } from './assign-form';

const STATUS_MAP: Record<string, { label: string; variant: 'secondary' | 'gold' | 'muted' | 'destructive' }> = {
  geplant: { label: 'Geplant', variant: 'muted' },
  in_arbeit: { label: 'In Arbeit', variant: 'gold' },
  erledigt: { label: '✓ Erledigt', variant: 'secondary' },
  übersprungen: { label: 'Übersprungen', variant: 'destructive' },
};

export default async function CleaningPlanPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireManagerPlus();
  const params = await searchParams;
  const supabase = await createClient();
  const date = params.date ?? new Date().toISOString().slice(0, 10);

  const [{ data: assignments }, { data: zones }, { data: employees }] = await Promise.all([
    supabase.from('cleaning_assignments')
      .select('*,zone:cleaning_zones(name,icon),employee:employees!cleaning_assignments_employee_id_fkey(vorname,nachname)')
      .eq('datum', date).order('phase').order('created_at'),
    supabase.from('cleaning_zones').select('id,name,icon').eq('aktiv', true).order('recommended_order'),
    supabase.from('employees').select('id,vorname,nachname').in('status', ['aktiv', 'in_probe']).order('nachname'),
  ]);

  const phases = ['morning', 'evening', 'weekly'] as const;
  const phaseLabels: Record<string, string> = { morning: '☀️ Morgens', evening: '🌙 Abends', weekly: '📅 Wöchentlich' };

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/cleaning"
        title="Reinigungsplan"
        description={`Wer macht welche Zone — ${new Date(date).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}`}
        actions={
          <form className="flex items-center gap-2">
            <input name="date" type="date" defaultValue={date}
              className="h-9 rounded-md border bg-background px-3 text-sm"
              onChange={e => e.currentTarget.form!.requestSubmit()} />
          </form>
        }
      />

      <AssignCleaningForm zones={zones ?? []} employees={employees ?? []} date={date} />

      {phases.map(ph => {
        const phAssign = (assignments ?? []).filter((a: any) => a.phase === ph);
        if (phAssign.length === 0) return null;
        return (
          <Card key={ph}>
            <CardHeader><CardTitle>{phaseLabels[ph]}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Zone</TableHead>
                  <TableHead>Mitarbeiter</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erledigt</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {phAssign.map((a: any) => {
                    const s = STATUS_MAP[a.status] ?? STATUS_MAP.geplant;
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">
                          <span className="mr-2">{a.zone?.icon}</span>{a.zone?.name}
                        </TableCell>
                        <TableCell>{a.employee ? `${a.employee.vorname} ${a.employee.nachname}` : '—'}</TableCell>
                        <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {a.erledigt_am ? dateDE(a.erledigt_am) : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      {(assignments ?? []).length === 0 && (
        <EmptyState title="Kein Reinigungsplan für diesen Tag" description="Nutze das Formular oben um Zonen zuzuweisen." />
      )}
    </div>
  );
}
