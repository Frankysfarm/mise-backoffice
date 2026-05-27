import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Sparkles } from 'lucide-react';

export default async function TrainingPage() {
  await requireManagerPlus();
  const supabase = await createClient();
  const { data: modulesRaw } = await supabase.from('training_modules')
    .select('*')
    .order('reihenfolge');
  const modules = modulesRaw as any[] | null;

  return (
    <div>
      <PageHeader
        title="Schulungen"
        description={`${modules?.length ?? 0} Module.`}
        actions={<>
          <Link href="/training/ai-create"><Button variant="secondary" className="gap-2"><Sparkles className="h-4 w-4" /> AI erstellen</Button></Link>
          <Link href="/training/new"><Button><Plus className="h-4 w-4" /> Manuell</Button></Link>
        </>}
      />
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
                    <Link href={`/training/${m.id}`} className="hover:underline">{m.titel}</Link>
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
