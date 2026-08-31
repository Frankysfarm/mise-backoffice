import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Sparkles } from 'lucide-react';
import { operationsBasePath } from '@/lib/routing/operations-base-path';
import { trainingStatus } from '@/lib/training/domain';

export default async function TrainingPage() {
  const actor = await requireManagerPlus();
  if (!actor.tenant_id) throw new Error('Betrieb fehlt.');
  const basePath = await operationsBasePath('/training', '/neo/app/schulungen');
  const supabase = createServiceClient();
  const { data: modulesRaw } = await supabase.from('training_modules')
    .select('*')
    .eq('tenant_id', actor.tenant_id)
    .order('reihenfolge');
  const modules = modulesRaw as any[] | null;
  const { data: progress } = await supabase.from('training_progress').select('status,due_at').eq('tenant_id', actor.tenant_id);
  const counts = (progress ?? []).reduce((all: Record<string, number>, row: any) => { const status = trainingStatus(row.status, row.due_at); all[status] = (all[status] ?? 0) + 1; return all; }, {});

  return (
    <div>
      <PageHeader
        title="Schulungen"
        description={`${modules?.length ?? 0} Module.`}
        actions={<>
          <Link href={`${basePath}/ai-create`}><Button variant="secondary" className="gap-2"><Sparkles className="h-4 w-4" /> AI erstellen</Button></Link>
          <Link href={`${basePath}/new`}><Button><Plus className="h-4 w-4" /> Manuell</Button></Link>
        </>}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[['offen','Offen'],['begonnen','Begonnen'],['bestanden','Bestanden'],['ueberfaellig','Überfällig']].map(([key,label]) => <Card key={key} className={key === 'ueberfaellig' && counts[key] ? 'border-red-300' : ''}><div className="p-4"><div className="text-2xl font-bold">{counts[key] ?? 0}</div><div className="text-sm text-muted-foreground">{label}</div></div></Card>)}</div>
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Reihenfolge</TableHead><TableHead>Titel</TableHead><TableHead>Kategorie</TableHead>
            <TableHead>Position</TableHead>
            <TableHead className="text-right">Dauer (Min.)</TableHead>
            <TableHead>Pflicht</TableHead><TableHead>Gültig (Mon.)</TableHead>
            <TableHead className="text-right">Lektionen</TableHead>
            <TableHead>Aktiv</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {modules?.map(m => {
              const lessons = Array.isArray((m.inhalt as any)?.lessons) ? (m.inhalt as any).lessons.length : 0;
              return (
                <TableRow key={m.id} className="cursor-pointer">
                  <TableCell className="font-mono text-xs">{m.reihenfolge ?? '—'}</TableCell>
                  <TableCell className="font-medium">
                    <Link href={`${basePath}/${m.id}`} className="hover:underline">{m.titel}</Link>
                  </TableCell>
                  <TableCell>{m.kategorie ?? '—'}</TableCell>
                  <TableCell>{m.position_typ ?? '—'}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{m.dauer_minuten ?? '—'}</TableCell>
                  <TableCell>{m.pflicht ? <Badge variant="gold">Pflicht</Badge> : <Badge variant="muted">Optional</Badge>}</TableCell>
                  <TableCell className="text-sm">{m.gültig_monate ?? '∞'}</TableCell>
                  <TableCell className="text-right font-mono">{lessons}</TableCell>
                  <TableCell>{m.aktiv ? '✓' : '—'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
