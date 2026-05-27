import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty';
import { dateTimeDE, euro } from '@/lib/utils';
import { NewOrderButton } from './new-order';
import { SendOrderButton } from './send-button';

export default async function OrdersPage() {
  await requireManagerPlus();
  const supabase = await createClient();
  const [{ data: orders }, { data: items }, { data: locs }] = await Promise.all([
    supabase.from('order_lists')
      .select('*,location:locations(name),creator:employees!order_lists_erstellt_von_fkey(vorname,nachname)')
      .order('created_at', { ascending: false }).limit(50),
    supabase.from('inventory_items').select('id,name,lieferant,einheit,preis_pro_einheit,artikelnummer,min_bestand,soll_bestand').eq('aktiv', true),
    supabase.from('locations').select('id,name').order('name'),
  ]);

  const statusVariant = (s: string) =>
    s === 'bestellt' ? 'secondary' : s === 'geliefert' ? 'accent' : 'gold';

  return (
    <div>
      <PageHeader
        title="Bestelllisten"
        description={`${orders?.length ?? 0} Bestellungen — Versand via order-list-mail.`}
        backHref="/inventory"
        actions={<NewOrderButton items={items ?? []} locations={locs ?? []} />}
      />
      {(orders?.length ?? 0) === 0 ? (
        <EmptyState title="Noch keine Bestellliste" description="Erstelle eine Liste aus Produkten, die unter Mindestbestand sind." />
      ) : (
        <Card>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Erstellt</TableHead>
              <TableHead>Lieferant</TableHead>
              <TableHead>Standort</TableHead>
              <TableHead className="text-right">Positionen</TableHead>
              <TableHead className="text-right">Gesamt</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {orders!.map(o => {
                const pos = Array.isArray(o.positionen) ? o.positionen.length : 0;
                return (
                  <TableRow key={o.id}>
                    <TableCell>{dateTimeDE(o.created_at)}</TableCell>
                    <TableCell className="font-medium">{o.lieferant ?? '—'}</TableCell>
                    <TableCell>{(o.location as any)?.name ?? '—'}</TableCell>
                    <TableCell className="text-right font-mono">{pos}</TableCell>
                    <TableCell className="text-right font-mono">{o.gesamtbetrag ? euro(o.gesamtbetrag) : '—'}</TableCell>
                    <TableCell><Badge variant={statusVariant(o.status)}>{o.status}</Badge></TableCell>
                    <TableCell>
                      {o.status === 'entwurf' && <SendOrderButton orderId={o.id} />}
                    </TableCell>
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
