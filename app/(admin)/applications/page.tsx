import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty';
import { dateTimeDE } from '@/lib/utils';
import { InviteApplicantButton } from './invite-button';

export default async function ApplicationsPage() {
  await requireManagerPlus();
  const supabase = await createClient();
  const [{ data: apps }, { data: locs }] = await Promise.all([
    supabase.from('employees')
      .select('id,vorname,nachname,email,status,invite_token,invite_expires_at,beworben_am,created_at,location:locations(name)')
      .in('status', ['registriert', 'wartet_zuteilung'])
      .order('created_at', { ascending: false }),
    supabase.from('locations').select('id,name').order('name'),
  ]);

  return (
    <div>
      <PageHeader
        title="Bewerbungen"
        description="Offene Einladungen und eingereichte Bewerbungen — hier weist du Abteilung zu."
        actions={<InviteApplicantButton locations={locs ?? []} />}
      />
      {(apps?.length ?? 0) === 0 ? (
        <EmptyState title="Keine offenen Bewerbungen" description="Klicke oben rechts, um jemanden einzuladen." />
      ) : (
        <Card>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead>
              <TableHead>E-Mail</TableHead>
              <TableHead>Standort</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Beworben</TableHead>
              <TableHead>Einladung</TableHead>
              <TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {apps!.map(a => {
                const expired = a.invite_expires_at && new Date(a.invite_expires_at) < new Date();
                const submitted = a.status === 'wartet_zuteilung';
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.vorname} {a.nachname}</TableCell>
                    <TableCell className="text-sm">{a.email ?? '—'}</TableCell>
                    <TableCell className="text-sm">{(a.location as any)?.name ?? '—'}</TableCell>
                    <TableCell>
                      {submitted ? <Badge variant="gold">📥 eingereicht</Badge>
                        : expired ? <Badge variant="destructive">⏰ abgelaufen</Badge>
                        : <Badge variant="muted">⏳ wartet auf Eintrag</Badge>}
                    </TableCell>
                    <TableCell className="text-sm">{a.beworben_am ? dateTimeDE(a.beworben_am) : '—'}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {!submitted && !expired && a.invite_token && <CopyLink token={a.invite_token} />}
                    </TableCell>
                    <TableCell>
                      {submitted && <Link href={`/applications/${a.id}`}><Badge>Zuweisen →</Badge></Link>}
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

function CopyLink({ token }: { token: string }) {
  return <span>/register/{token.slice(0, 8)}…</span>;
}
