import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty';
import { dateDE } from '@/lib/utils';

function ampel(ablauf: string | null) {
  if (!ablauf) return { label: '—', variant: 'muted' as const };
  const days = Math.round((new Date(ablauf).getTime() - Date.now()) / 86_400_000);
  if (days < 0)   return { label: `abgelaufen seit ${-days} T.`, variant: 'destructive' as const };
  if (days <= 14) return { label: `läuft in ${days} T. ab`, variant: 'destructive' as const };
  if (days <= 30) return { label: `läuft in ${days} T. ab`, variant: 'gold' as const };
  return { label: `${days} T. gültig`, variant: 'secondary' as const };
}

export default async function DocumentsPage() {
  await requireManagerPlus();
  const supabase = await createClient();
  const { data: docs } = await supabase.from('documents')
    .select('id,titel,kategorie,ablaufdatum,created_at,employee:employees!documents_employee_id_fkey(id,vorname,nachname)')
    .order('ablaufdatum', { ascending: true, nullsFirst: false });

  return (
    <div>
      <PageHeader title="Dokumente" description="Verträge, Gesundheitszeugnisse & Co. — mit Ablauf-Ampel." />
      {(docs?.length ?? 0) === 0 ? (
        <EmptyState title="Noch keine Dokumente" />
      ) : (
        <Card>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Titel</TableHead>
              <TableHead>Kategorie</TableHead>
              <TableHead>Mitarbeiter:in</TableHead>
              <TableHead>Ablauf</TableHead>
              <TableHead>Ampel</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {docs!.map(d => {
                const a = ampel(d.ablaufdatum);
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.titel}</TableCell>
                    <TableCell>{d.kategorie ?? '—'}</TableCell>
                    <TableCell>
                      {d.employee ? <Link href={`/employees/${(d.employee as any).id}`} className="hover:underline">
                        {(d.employee as any).vorname} {(d.employee as any).nachname}
                      </Link> : '—'}
                    </TableCell>
                    <TableCell>{dateDE(d.ablaufdatum)}</TableCell>
                    <TableCell><Badge variant={a.variant}>{a.label}</Badge></TableCell>
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
