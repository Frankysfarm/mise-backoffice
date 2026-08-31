import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty';
import { dateTimeDE } from '@/lib/utils';
import { operationsBasePath } from '@/lib/routing/operations-base-path';

export default async function InventorySessionsPage() {
  await requireManagerPlus();
  const basePath = await operationsBasePath('/inventory', '/neo/app/lager');
  const supabase = await createClient();
  const { data: sessions } = await supabase.from('inventory_sessions')
    .select('*,location:locations(name),area:inventory_areas(name),starter:employees!inventory_sessions_gestartet_von_fkey(vorname,nachname),assignee:employees!inventory_sessions_assigned_to_fkey(vorname,nachname)')
    .or('typ.is.null,typ.neq.spontan')
    .order('gestartet_am', { ascending: false }).limit(50);

  return (
    <div>
      <PageHeader
        title="Inventur-Sessions"
        description={`${sessions?.length ?? 0} Inventuren in der Historie.`}
        backHref={basePath}
        actions={<Link href={`${basePath}/assign`}><Button>Inventur zuweisen</Button></Link>}
      />
      {(sessions?.length ?? 0) === 0 ? (
        <EmptyState title="Noch keine Inventur" description="Starte eine neue Inventur um Bestände zu zählen." />
      ) : (
        <Card>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Zugewiesen am</TableHead>
              <TableHead>Standort</TableHead>
              <TableHead>Bereich</TableHead>
              <TableHead>Zugewiesen an</TableHead>
              <TableHead>Abgeschlossen</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notiz</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {sessions!.map(s => (
                <TableRow key={s.id}>
                  <TableCell>{dateTimeDE(s.gestartet_am)}</TableCell>
                  <TableCell>{(s.location as any)?.name ?? '—'}</TableCell>
                  <TableCell>{(s.area as any)?.name ?? '—'}</TableCell>
                  <TableCell>{(s.assignee as any) ? `${(s.assignee as any).vorname} ${(s.assignee as any).nachname}` : '—'}</TableCell>
                  <TableCell>{s.abgeschlossen_am ? dateTimeDE(s.abgeschlossen_am) : '—'}</TableCell>
                  <TableCell>{s.abgeschlossen_am
                    ? <Badge variant="secondary">✓ Fertig</Badge>
                    : <Badge variant="gold">Geplant</Badge>}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.notiz ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
