import Link from 'next/link';
import { ArrowRight, CheckCircle2, ClipboardCheck, UserRoundSearch } from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty';
import { dateTimeDE } from '@/lib/utils';
import { operationsBasePath } from '@/lib/routing/operations-base-path';
import { InviteApplicantButton } from './invite-button';

const ACTIVE_STATUSES = ['registriert', 'wartet_zuteilung', 'in_probe'] as const;

const STATUS_META: Record<string, { label: string; variant: 'muted' | 'gold' | 'accent' | 'destructive' }> = {
  registriert: { label: 'Einladung offen', variant: 'muted' },
  wartet_zuteilung: { label: 'Daten prüfen', variant: 'gold' },
  in_probe: { label: 'In Probearbeit', variant: 'accent' },
  abgelehnt: { label: 'Abgelehnt', variant: 'destructive' },
};

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ ansicht?: string }> }) {
  const currentEmployee = await requireManagerPlus();
  if (!currentEmployee.tenant_id) throw new Error('Mitarbeiterkonto ist keinem Mandanten zugeordnet.');
  const params = await searchParams;
  const archived = params.ansicht === 'archiv';
  const basePath = await operationsBasePath('/applications', '/neo/app/bewerbungen');
  const testsPath = '/neo/app/tests';
  // Auth is checked above; the service client lets managers see application
  // progress while every query remains explicitly tenant-scoped.
  const supabase = createServiceClient();
  const [{ data: apps }, { data: activeCounts }, { count: rejectedCount }, { data: locations }] = await Promise.all([
    supabase.from('employees')
      .select('id,vorname,nachname,email,status,invite_token,invite_expires_at,beworben_am,created_at,location:locations(name)')
      .eq('tenant_id', currentEmployee.tenant_id)
      .in('status', archived ? ['abgelehnt'] : [...ACTIVE_STATUSES])
      .order('created_at', { ascending: false }),
    supabase.from('employees')
      .select('status')
      .eq('tenant_id', currentEmployee.tenant_id)
      .in('status', [...ACTIVE_STATUSES]),
    supabase.from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', currentEmployee.tenant_id)
      .eq('status', 'abgelehnt'),
    supabase.from('locations').select('id,name').eq('tenant_id', currentEmployee.tenant_id).order('name'),
  ]);

  const counts = Object.fromEntries(ACTIVE_STATUSES.map((status) => [status, activeCounts?.filter((row) => row.status === status).length ?? 0]));

  return (
    <div>
      <PageHeader
        title="Bewerbungen & Probearbeit"
        description="Erst kennenlernen und bewerten, dann bewusst als Mitarbeiter übernehmen."
        actions={<><Link href={testsPath}><Button variant="secondary">Bewerbungstests verwalten</Button></Link><InviteApplicantButton locations={locations ?? []} /></>}
      />

      <div className="mb-6 grid grid-cols-1 overflow-hidden rounded-xl border bg-white shadow-subtle sm:grid-cols-4">
        <Stage number="1" title="Bewerbung" detail={`${counts.registriert} offen`} icon={<UserRoundSearch className="h-4 w-4" />} />
        <Stage number="2" title="Daten prüfen" detail={`${counts.wartet_zuteilung} bereit`} />
        <Stage number="3" title="Probearbeit" detail={`${counts.in_probe} laufend`} icon={<ClipboardCheck className="h-4 w-4" />} />
        <Stage number="4" title="Entscheidung" detail="Einstellen oder ablehnen" icon={<CheckCircle2 className="h-4 w-4" />} last />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={basePath}><Button variant={archived ? 'ghost' : 'secondary'} size="sm">Aktive Bewerbungen</Button></Link>
        <Link href={`${basePath}?ansicht=archiv`}><Button variant={archived ? 'secondary' : 'ghost'} size="sm">Archiv ({rejectedCount ?? 0})</Button></Link>
      </div>

      {(apps?.length ?? 0) === 0 ? (
        <EmptyState
          title={archived ? 'Keine abgelehnten Bewerbungen' : 'Keine offenen Bewerbungen'}
          description={archived ? 'Abgelehnte Bewerbungen erscheinen später hier.' : 'Lade eine Person ein, um den Bewerbungsprozess zu starten.'}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead>Standort</TableHead>
              <TableHead>Eingang</TableHead><TableHead>Einladung</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {apps!.map((application) => {
                const expired = application.invite_expires_at && new Date(application.invite_expires_at) < new Date();
                const status = STATUS_META[application.status] ?? STATUS_META.registriert;
                return (
                  <TableRow key={application.id}>
                    <TableCell className="min-w-52 font-medium">
                      {application.vorname} {application.nachname}
                      <div className="text-xs font-normal text-muted-foreground">{application.email}</div>
                    </TableCell>
                    <TableCell><Badge variant={expired && application.status === 'registriert' ? 'destructive' : status.variant}>{expired && application.status === 'registriert' ? 'Einladung abgelaufen' : status.label}</Badge></TableCell>
                    <TableCell>{(application.location as any)?.name ?? 'Noch offen'}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{application.beworben_am ? dateTimeDE(application.beworben_am) : dateTimeDE(application.created_at)}</TableCell>
                    <TableCell className="font-mono text-xs">{application.status === 'registriert' && !expired && application.invite_token ? `/register/${application.invite_token.slice(0, 8)}…` : '—'}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`${basePath}/${application.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:underline">
                        {application.status === 'wartet_zuteilung' ? 'Prüfen' : application.status === 'in_probe' ? 'Probearbeit' : 'Ansehen'} <ArrowRight className="h-4 w-4" />
                      </Link>
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

function Stage({ number, title, detail, icon, last = false }: { number: string; title: string; detail: string; icon?: React.ReactNode; last?: boolean }) {
  return (
    <div className={`relative flex min-h-24 items-center gap-3 p-4 ${last ? '' : 'border-b sm:border-b-0 sm:border-r'}`}>
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-700">{icon ?? number}</div>
      <div><div className="text-sm font-semibold">{number}. {title}</div><div className="mt-0.5 text-xs text-muted-foreground">{detail}</div></div>
    </div>
  );
}
