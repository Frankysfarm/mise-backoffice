import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty';
import { dateTimeDE } from '@/lib/utils';
import { ReceivingForm } from './form';

export default async function ReceivingPage() {
  await requireManagerPlus();
  const supabase = await createClient();
  const [{ data: receiving }, { data: pendingOrders }, { data: suppliers }] = await Promise.all([
    supabase.from('inventory_receiving')
      .select('*,supplier:suppliers(name),employee:employees!inventory_receiving_empfangen_von_fkey(vorname,nachname)')
      .order('created_at', { ascending: false }).limit(30),
    supabase.from('order_lists').select('id,lieferant,supplier_id,gesamtbetrag,positionen,bestellt_am')
      .in('status', ['bestellt']).order('bestellt_am', { ascending: false }),
    supabase.from('suppliers').select('id,name').eq('aktiv', true).order('name'),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader backHref="/inventory" title="Wareneingang"
        description="Lieferung prüfen: Was ist da, was fehlt, wo kommt es hin?" />

      <ReceivingForm pendingOrders={(pendingOrders ?? []) as any[]} suppliers={suppliers ?? []} />

      {(receiving ?? []).length === 0 ? (
        <EmptyState title="Noch kein Wareneingang erfasst" />
      ) : (
        <Card>
          <CardHeader><CardTitle>Letzte Wareneingänge</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Lieferant</TableHead>
                <TableHead>Empfangen von</TableHead>
                <TableHead>Temp OK</TableHead>
                <TableHead>MHD OK</TableHead>
                <TableHead>Menge OK</TableHead>
                <TableHead>Notiz</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(receiving ?? []).map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{dateTimeDE(r.empfangen_am)}</TableCell>
                    <TableCell className="font-medium">{r.supplier?.name ?? '—'}</TableCell>
                    <TableCell>{r.employee ? `${r.employee.vorname} ${r.employee.nachname}` : '—'}</TableCell>
                    <TableCell>{r.temperatur_ok === true ? <Badge variant="secondary">✓</Badge> : r.temperatur_ok === false ? <Badge variant="destructive">✗</Badge> : '—'}</TableCell>
                    <TableCell>{r.mhd_ok === true ? <Badge variant="secondary">✓</Badge> : r.mhd_ok === false ? <Badge variant="destructive">✗</Badge> : '—'}</TableCell>
                    <TableCell>{r.menge_ok === true ? <Badge variant="secondary">✓</Badge> : r.menge_ok === false ? <Badge variant="destructive">✗</Badge> : '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.notiz ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
