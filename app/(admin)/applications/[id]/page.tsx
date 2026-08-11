import Link from 'next/link';
import { CheckCircle2, Clock3, XCircle } from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { dateTimeDE } from '@/lib/utils';
import { operationsBasePath } from '@/lib/routing/operations-base-path';
import { notFound } from 'next/navigation';
import { TrialSetupForm } from './trial-setup-form';
import { ProbeReview } from '../../employees/[id]/probe-review';

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const currentEmployee = await requireManagerPlus();
  if (!currentEmployee.tenant_id) throw new Error('Mitarbeiterkonto ist keinem Mandanten zugeordnet.');
  const basePath = await operationsBasePath('/applications', '/neo/app/bewerbungen');
  const employeeBasePath = basePath.startsWith('/neo/') ? '/neo/app/mitarbeiter' : '/employees';
  const { id } = await params;
  // Application progress and reviews are intentionally manager-visible here;
  // the candidate is verified against the current tenant before linked reads.
  const supabase = createServiceClient();

  const { data: application } = await supabase.from('employees')
    .select('*,location:locations(id,name),department:departments(id,name)')
    .eq('id', id)
    .eq('tenant_id', currentEmployee.tenant_id)
    .maybeSingle();
  if (!application) notFound();

  const [{ data: progress }, { data: departmentsRaw }, { data: locations }, { data: trialShifts }, { data: reviews }] = await Promise.all([
    supabase.from('onboarding_progress').select('daten').eq('employee_id', id).maybeSingle(),
    supabase.from('departments')
      .select('id,name,location_id,location:locations!inner(tenant_id)')
      .eq('location.tenant_id', currentEmployee.tenant_id)
      .order('name'),
    supabase.from('locations').select('id,name').eq('tenant_id', currentEmployee.tenant_id).order('name'),
    supabase.from('shifts').select('id,start_zeit,end_zeit,position,status,notiz,location:locations(name),department:departments(name)').eq('employee_id', id).eq('typ', 'probe').order('start_zeit', { ascending: false }),
    supabase.from('performance_reviews').select('*').eq('employee_id', id).order('created_at', { ascending: false }),
  ]);
  const departments = (departmentsRaw ?? []).map(({ id: departmentId, name, location_id }) => ({ id: departmentId, name, location_id }));
  const data = (progress?.daten as Record<string, any>) ?? {};
  const latestReview = reviews?.[0] ?? null;
  const finishedTrialExists = (trialShifts ?? []).some((shift) => new Date(shift.end_zeit) <= new Date());
  const decisionComplete = ['in_training', 'aktiv', 'abgelehnt'].includes(application.status);

  return (
    <div>
      <PageHeader
        backHref={basePath}
        title={`${application.vorname} ${application.nachname}`}
        description={<StatusLine status={application.status} />}
        actions={['in_training', 'aktiv'].includes(application.status) ? <Link href={`${employeeBasePath}/${application.id}`}><Button>Zum Mitarbeiterprofil</Button></Link> : undefined}
      />

      <Pipeline status={application.status} />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Bewerbungsdaten</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Group title="Persönlich & Kontakt">
              <Row label="E-Mail" value={application.email} />
              <Row label="Geburtsdatum" value={data.geburtsdatum ?? application.geburtsdatum} />
              <Row label="Telefon" value={data.telefon ?? application.telefon} />
              <Row label="Adresse" value={[data.adresse_strasse ?? application.adresse_strasse, data.adresse_plz ?? application.adresse_plz, data.adresse_stadt ?? application.adresse_stadt].filter(Boolean).join(', ')} />
            </Group>
            <Group title="Arbeitswunsch">
              <Row label="Einsatzbereich" value={data.position_typ ?? application.position_typ} />
              <Row label="Anstellungsart" value={data.employment_type ?? application.employment_type} />
              <Row label="Wunsch-Wochenstunden" value={data.wochenstunden ?? application.wochenstunden} />
            </Group>
            <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">Steuer-, Bank- und Vertragsdaten werden erst nach einer positiven Einstellungsentscheidung im Mitarbeiterprofil ergänzt.</p>
          </CardContent>
        </Card>

        {application.status === 'registriert' && (
          <OutcomeCard icon={<Clock3 className="h-6 w-6 text-amber-600" />} title="Einladung noch offen" text="Die Person hat ihre Bewerbungsdaten noch nicht vollständig abgeschickt." />
        )}
        {application.status === 'wartet_zuteilung' && (
          <Card><CardHeader><CardTitle>Probearbeit planen</CardTitle></CardHeader><CardContent><TrialSetupForm applicationId={id} locations={locations ?? []} departments={departments} initialLocationId={application.location_id} initialDepartmentId={application.department_id} initialPosition={data.position_typ ?? application.position_typ} /></CardContent></Card>
        )}
        {application.status === 'in_probe' && (
          <Card><CardHeader><CardTitle>Weitere Probearbeit</CardTitle></CardHeader><CardContent><TrialSetupForm applicationId={id} locations={locations ?? []} departments={departments} initialLocationId={application.location_id} initialDepartmentId={application.department_id} initialPosition={data.position_typ ?? application.position_typ} /></CardContent></Card>
        )}
        {['in_training', 'aktiv'].includes(application.status) && (
          <OutcomeCard icon={<CheckCircle2 className="h-6 w-6 text-emerald-600" />} title="Eingestellt" text="Die Person ist jetzt ein Mitarbeiter und startet mit Einarbeitung und Pflichtschulungen." />
        )}
        {application.status === 'abgelehnt' && (
          <OutcomeCard icon={<XCircle className="h-6 w-6 text-red-600" />} title="Nicht eingestellt" text="Die Bewerbung ist abgeschlossen und im Archiv abgelegt." />
        )}
      </div>

      {(trialShifts?.length ?? 0) > 0 && (
        <Card className="mt-6">
          <CardHeader><CardTitle>Geplante Probearbeit</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {trialShifts!.map((shift) => (
              <div key={shift.id} className="rounded-lg border bg-muted/20 p-4 text-sm">
                <div className="font-semibold">{dateTimeDE(shift.start_zeit)} – {new Date(shift.end_zeit).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
                <div className="mt-1 text-muted-foreground">{shift.position ?? 'Einsatzbereich offen'} · {(shift.location as any)?.name ?? 'Standort offen'} · {(shift.department as any)?.name ?? 'Abteilung offen'}</div>
                {shift.notiz && <p className="mt-2 text-xs text-muted-foreground">{shift.notiz}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {application.status === 'in_probe' && (
        <div className="mt-6">
          {!finishedTrialExists && <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Die Bewertung wird freigeschaltet, sobald mindestens eine Probearbeit beendet ist.</div>}
          <ProbeReview employeeId={id} employeeStatus={application.status} probeShifts={(trialShifts as any[]) ?? []} existingReview={latestReview} disabled={!finishedTrialExists} />
        </div>
      )}

      {decisionComplete && latestReview && (
        <Card className="mt-6"><CardHeader><CardTitle>Abschließende Bewertung</CardTitle></CardHeader><CardContent><ReviewSummary review={latestReview} /></CardContent></Card>
      )}
    </div>
  );
}

function Pipeline({ status }: { status: string }) {
  const index = status === 'registriert' ? 0 : status === 'wartet_zuteilung' ? 1 : status === 'in_probe' ? 2 : 3;
  const labels = ['Bewerbung', 'Daten geprüft', 'Probearbeit', 'Entscheidung'];
  return <ol className="grid grid-cols-4 overflow-hidden rounded-xl border bg-white">{labels.map((label, stage) => <li key={label} className={`relative border-r p-3 text-center text-xs font-semibold last:border-r-0 sm:text-sm ${stage <= index ? 'bg-indigo-50 text-indigo-800' : 'text-muted-foreground'}`}><span className={`mx-auto mb-1 grid h-7 w-7 place-items-center rounded-full ${stage <= index ? 'bg-indigo-600 text-white' : 'bg-muted'}`}>{stage + 1}</span>{label}</li>)}</ol>;
}

function StatusLine({ status }: { status: string }) {
  const labels: Record<string, string> = { registriert: 'Einladung offen', wartet_zuteilung: 'Daten bereit zur Prüfung', in_probe: 'Probearbeit läuft', in_training: 'Eingestellt · Einarbeitung', aktiv: 'Eingestellt · aktiv', abgelehnt: 'Nicht eingestellt' };
  return <span>{labels[status] ?? status}</span>;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div><div className="space-y-2 rounded-md border bg-muted/20 p-3">{children}</div></div>;
}

function Row({ label, value }: { label: string; value: any }) {
  return <div className="flex items-start justify-between gap-6"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value || <Badge variant="muted">fehlt</Badge>}</span></div>;
}

function OutcomeCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <Card><CardContent className="flex gap-3 p-5"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted/50">{icon}</div><div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{text}</p></div></CardContent></Card>;
}

function ReviewSummary({ review }: { review: any }) {
  const categories = review.kategorien ?? {};
  const labels: Record<string, string> = { punktlichkeit: 'Pünktlichkeit', arbeitsqualitaet: 'Arbeitsqualität', kundenumgang: 'Umgang mit Gästen', teamwork: 'Teamwork', lernbereitschaft: 'Lernbereitschaft' };
  return <div className="space-y-4"><div className="grid grid-cols-2 gap-2 md:grid-cols-5">{Object.entries(labels).map(([key, label]) => <div key={key} className="rounded-lg border p-3 text-center"><div className="text-2xl font-bold text-indigo-700">{categories[key] ?? '—'}</div><div className="mt-1 text-xs text-muted-foreground">{label}</div></div>)}</div><div className="grid gap-3 md:grid-cols-2"><Group title="Stärken"><p>{review.stärken || '—'}</p></Group><Group title="Entwicklungsfelder"><p>{review.entwicklungsfelder || '—'}</p></Group></div></div>;
}
