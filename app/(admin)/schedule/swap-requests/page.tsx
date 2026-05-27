import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty';
import { dateTimeDE } from '@/lib/utils';
import { SwapActions } from './actions';

export default async function SwapRequestsPage() {
  await requireManagerPlus();
  const supabase = await createClient();
  const { data: swapsRaw } = await supabase.from('shift_swaps')
    .select('*')
    .order('created_at', { ascending: false });
  const swaps = swapsRaw as any[] | null;

  return (
    <div>
      <PageHeader backHref="/schedule" title="Schichttausch-Anfragen" description={`${swaps?.length ?? 0} Einträge.`} />
      {(swaps?.length ?? 0) === 0 ? (
        <EmptyState title="Keine Anfragen" />
      ) : (
        <Card>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Datum</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Grund</TableHead>
              <TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {swaps!.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="text-sm">{dateTimeDE(s.created_at)}</TableCell>
                  <TableCell><Badge variant={s.status === 'angenommen' ? 'secondary' : s.status === 'abgelehnt' ? 'destructive' : 'gold'}>{s.status}</Badge></TableCell>
                  <TableCell className="text-sm">{s.grund ?? '—'}</TableCell>
                  <TableCell><SwapActions id={s.id} status={s.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
