import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty';
import { dateTimeDE } from '@/lib/utils';

const TYP_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'gold' | 'muted' }> = {
  eingang:    { label: '📥 Eingang',    variant: 'secondary' },
  ausgang:    { label: '📤 Ausgang',    variant: 'gold' },
  inventur:   { label: '📋 Inventur',   variant: 'default' },
  schwund:    { label: '🗑 Schwund',     variant: 'destructive' },
  korrektur:  { label: '🔧 Korrektur',  variant: 'muted' },
  transfer:   { label: '🔄 Transfer',   variant: 'muted' },
  verbrauch:  { label: '☕ Verbrauch',   variant: 'gold' },
};

export default async function MovementsPage() {
  await requireManagerPlus();
  const supabase = await createClient();
  const { data } = await supabase.from('stock_movements')
    .select('*,item:inventory_items(name,einheit),employee:employees!stock_movements_erfasst_von_fkey(vorname,nachname)')
    .order('created_at', { ascending: false }).limit(300);

  return (
    <div>
      <PageHeader backHref="/inventory" title="Bestandsbewegungen" description="Lückenloser Audit-Trail aller Lageränderungen." />
      {(data ?? []).length === 0 ? (
        <EmptyState title="Noch keine Bewegungen" />
      ) : (
        <Card>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Datum</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Produkt</TableHead>
              <TableHead className="text-right">Menge</TableHead>
              <TableHead className="text-right">Vorher</TableHead>
              <TableHead className="text-right">Nachher</TableHead>
              <TableHead>Von</TableHead>
              <TableHead>Notiz</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((m: any) => {
                const t = TYP_LABELS[m.typ] ?? { label: m.typ, variant: 'muted' };
                const positive = Number(m.menge) > 0;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="text-sm whitespace-nowrap">{dateTimeDE(m.created_at)}</TableCell>
                    <TableCell><Badge variant={t.variant as any}>{t.label}</Badge></TableCell>
                    <TableCell className="font-medium">{m.item?.name ?? '—'}</TableCell>
                    <TableCell className={`text-right font-mono font-semibold ${positive ? 'text-matcha-700' : 'text-destructive'}`}>
                      {positive ? '+' : ''}{m.menge} {m.item?.einheit ?? ''}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{m.vorher ?? '—'}</TableCell>
                    <TableCell className="text-right font-mono">{m.nachher ?? '—'}</TableCell>
                    <TableCell className="text-sm">{m.employee ? `${m.employee.vorname} ${m.employee.nachname}` : '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{m.notiz ?? '—'}</TableCell>
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
