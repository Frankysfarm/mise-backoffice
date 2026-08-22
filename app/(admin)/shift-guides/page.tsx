import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default async function ShiftGuidesPage() {
  await requireManagerPlus();
  const supabase = await createClient();
  const { data: guides } = await supabase.from('shift_guides')
    .select('id,titel,phase,position_typ,aktiv,version,inhalt,department:departments(name)')
    .order('titel');

  return (
    <div>
      <PageHeader title="Schichtleitfäden" description="Aufmach- und Zumach-Anweisungen pro Position." />
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Titel</TableHead>
            <TableHead>Phase</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Abteilung</TableHead>
            <TableHead className="text-right">Kategorien</TableHead>
            <TableHead className="text-right">Schritte</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Aktiv</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {guides?.map(g => {
              const cats = Array.isArray((g.inhalt as any)?.categories) ? (g.inhalt as any).categories : [];
              const steps = cats.reduce((acc: number, c: any) => acc + (c.steps?.length ?? 0), 0);
              return (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">
                    <Link href={`/shift-guides/${g.id}`} className="hover:underline">{g.titel}</Link>
                  </TableCell>
                  <TableCell><Badge variant={g.phase === 'opening' ? 'secondary' : 'gold'}>{g.phase}</Badge></TableCell>
                  <TableCell>{g.position_typ ?? '—'}</TableCell>
                  <TableCell>{(g.department as any)?.name ?? '—'}</TableCell>
                  <TableCell className="text-right font-mono">{cats.length}</TableCell>
                  <TableCell className="text-right font-mono">{steps}</TableCell>
                  <TableCell className="font-mono text-xs">v{g.version}</TableCell>
                  <TableCell>{g.aktiv ? '✓' : '—'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
