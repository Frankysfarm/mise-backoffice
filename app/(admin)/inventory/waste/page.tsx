import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty';
import { dateTimeDE, euro } from '@/lib/utils';
import { WasteForm } from './form';

const GRUND_LABELS: Record<string, string> = {
  abgelaufen: 'Abgelaufen', verdorben: 'Verdorben', beschädigt: 'Beschädigt',
  überproduktion: 'Überproduktion', fehlbestellung: 'Fehlbestellung', sonstiges: 'Sonstiges',
};
const GRUND_COLORS: Record<string, 'destructive' | 'gold' | 'muted'> = {
  abgelaufen: 'destructive', verdorben: 'destructive', beschädigt: 'gold',
  überproduktion: 'gold', fehlbestellung: 'gold', sonstiges: 'muted',
};

export default async function WastePage() {
  await requireManagerPlus();
  const supabase = await createClient();
  const [{ data: waste }, { data: items }] = await Promise.all([
    supabase.from('inventory_waste')
      .select('*,item:inventory_items(name,einheit),employee:employees!inventory_waste_erfasst_von_fkey(vorname,nachname)')
      .order('created_at', { ascending: false }).limit(200),
    supabase.from('inventory_items').select('id,name,einheit,preis_pro_einheit').eq('aktiv', true).order('name'),
  ]);

  const total = (waste ?? []).reduce((s, w: any) => s + Number(w.wert_euro ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/inventory"
        title="Schwund / Waste"
        description={`${(waste ?? []).length} Einträge · Gesamtwert: ${euro(total)}`}
      />

      <WasteForm items={(items ?? []) as any[]} />

      {(waste ?? []).length === 0 ? (
        <EmptyState title="Kein Schwund erfasst" description="Gut so — oder es wird noch nicht getrackt." />
      ) : (
        <Card>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Datum</TableHead>
              <TableHead>Produkt</TableHead>
              <TableHead className="text-right">Menge</TableHead>
              <TableHead>Grund</TableHead>
              <TableHead className="text-right">Wert</TableHead>
              <TableHead>Erfasst von</TableHead>
              <TableHead>Notiz</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(waste ?? []).map((w: any) => (
                <TableRow key={w.id}>
                  <TableCell className="text-sm">{dateTimeDE(w.created_at)}</TableCell>
                  <TableCell className="font-medium">{w.item?.name ?? '—'}</TableCell>
                  <TableCell className="text-right font-mono">{w.menge} {w.einheit ?? w.item?.einheit ?? ''}</TableCell>
                  <TableCell><Badge variant={GRUND_COLORS[w.grund] ?? 'muted'}>{GRUND_LABELS[w.grund] ?? w.grund}</Badge></TableCell>
                  <TableCell className="text-right font-mono text-destructive">{w.wert_euro ? euro(w.wert_euro) : '—'}</TableCell>
                  <TableCell className="text-sm">{w.employee ? `${w.employee.vorname} ${w.employee.nachname}` : '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{w.notiz ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
