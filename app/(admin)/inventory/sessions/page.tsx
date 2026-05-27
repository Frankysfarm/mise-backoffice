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
import { StartSessionButton } from './start-button';

export default async function InventorySessionsPage() {
  await requireManagerPlus();
  const supabase = await createClient();
  const [{ data: sessions }, { data: locs }] = await Promise.all([
    supabase.from('inventory_sessions')
      .select('*,location:locations(name),starter:employees!inventory_sessions_gestartet_von_fkey(vorname,nachname)')
      .order('gestartet_am', { ascending: false }).limit(50),
    supabase.from('locations').select('id,name').order('name'),
  ]);

  return (
    <div>
      <PageHeader
        title="Inventur-Sessions"
        description={`${sessions?.length ?? 0} Inventuren in der Historie.`}
        backHref="/inventory"
        actions={<StartSessionButton locations={locs ?? []} />}
      />
      {(sessions?.length ?? 0) === 0 ? (
        <EmptyState title="Noch keine Inventur" description="Starte eine neue Inventur um Bestände zu zählen." />
      ) : (
        <Card>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Gestartet am</TableHead>
              <TableHead>Standort</TableHead>
              <TableHead>Von</TableHead>
              <TableHead>Abgeschlossen</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notiz</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {sessions!.map(s => (
                <TableRow key={s.id}>
                  <TableCell>{dateTimeDE(s.gestartet_am)}</TableCell>
                  <TableCell>{(s.location as any)?.name ?? '—'}</TableCell>
                  <TableCell>{(s.starter as any)?.vorname} {(s.starter as any)?.nachname}</TableCell>
                  <TableCell>{s.abgeschlossen_am ? dateTimeDE(s.abgeschlossen_am) : '—'}</TableCell>
                  <TableCell>{s.abgeschlossen_am
                    ? <Badge variant="secondary">✓ Fertig</Badge>
                    : <Badge variant="gold">Läuft</Badge>}</TableCell>
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
