import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty';
import { dateDE, euro } from '@/lib/utils';
import { CashClosingDialog } from './new-closing';

export default async function CashPage() {
  await requireManagerPlus();
  const supabase = await createClient();
  const [{ data: closings }, { data: locs }] = await Promise.all([
    supabase.from('cash_closings').select('*,employee:employees!cash_closings_employee_id_fkey(vorname,nachname),location:locations(name)').order('datum', { ascending: false }).limit(60),
    supabase.from('locations').select('id,name').order('name'),
  ]);

  return (
    <div>
      <PageHeader
        title="Kassenabschluss"
        description="Tagesabschlüsse inkl. Soll/Ist-Differenz."
        actions={<CashClosingDialog locations={locs ?? []} />}
      />
      {(closings?.length ?? 0) === 0 ? (
        <EmptyState title="Noch keine Abschlüsse" />
      ) : (
        <Card>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Datum</TableHead>
              <TableHead>Standort</TableHead>
              <TableHead>Kassierer:in</TableHead>
              <TableHead className="text-right">Bar</TableHead>
              <TableHead className="text-right">Karte</TableHead>
              <TableHead className="text-right">Trinkgeld</TableHead>
              <TableHead className="text-right">Soll</TableHead>
              <TableHead className="text-right">Ist</TableHead>
              <TableHead className="text-right">Diff.</TableHead>
              <TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {closings!.map(c => {
                const diff = Number(c.differenz ?? 0);
                return (
                  <TableRow key={c.id}>
                    <TableCell>{dateDE(c.datum)}</TableCell>
                    <TableCell>{(c.location as any)?.name ?? '—'}</TableCell>
                    <TableCell>{(c.employee as any)?.vorname} {(c.employee as any)?.nachname}</TableCell>
                    <TableCell className="text-right font-mono">{euro(c.bar_einnahmen)}</TableCell>
                    <TableCell className="text-right font-mono">{euro(c.karten_einnahmen)}</TableCell>
                    <TableCell className="text-right font-mono">{euro(c.trinkgeld)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{euro(c.soll_bestand)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{euro(c.ist_bestand)}</TableCell>
                    <TableCell className={`text-right font-mono font-semibold ${Math.abs(diff) > 2 ? 'text-destructive' : 'text-matcha-700'}`}>
                      {euro(diff)}
                    </TableCell>
                    <TableCell>{c.abgeschlossen ? <Badge variant="secondary">✓ Abgeschlossen</Badge> : <Badge variant="gold">Offen</Badge>}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
