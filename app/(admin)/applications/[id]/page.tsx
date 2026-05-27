import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { notFound } from 'next/navigation';
import { AssignForm } from './assign-form';

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireManagerPlus();
  const { id } = await params;
  const supabase = await createClient();

  const { data: emp } = await supabase.from('employees')
    .select('*,location:locations(id,name)').eq('id', id).maybeSingle();
  if (!emp) notFound();

  const { data: progress } = await supabase.from('onboarding_progress')
    .select('daten').eq('employee_id', id).maybeSingle();
  const daten = (progress?.daten as Record<string, any>) ?? {};

  const [{ data: deps }, { data: locs }] = await Promise.all([
    supabase.from('departments').select('id,name,location_id').order('name'),
    supabase.from('locations').select('id,name').order('name'),
  ]);

  return (
    <div>
      <PageHeader
        backHref="/applications"
        title={`${emp.vorname} ${emp.nachname}`}
        description={`${emp.email} · Status: ${emp.status}`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Eingegebene Daten</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Group title="Persönlich">
              <Row l="Vorname" v={emp.vorname} />
              <Row l="Nachname" v={emp.nachname} />
              <Row l="Geburtsdatum" v={daten.geburtsdatum ?? emp.geburtsdatum} />
              <Row l="Telefon" v={daten.telefon ?? emp.telefon} />
              <Row l="Adresse" v={[daten.adresse_strasse ?? emp.adresse_strasse,
                daten.adresse_plz ?? emp.adresse_plz,
                daten.adresse_stadt ?? emp.adresse_stadt].filter(Boolean).join(', ')} />
            </Group>
            <Group title="Steuer & Bank">
              <Row l="Steuer-ID" v={daten.steuer_id ?? emp.steuer_id} />
              <Row l="SV-Nr." v={daten.sv_nummer ?? emp.sv_nummer} />
              <Row l="Krankenkasse" v={daten.krankenkasse ?? emp.krankenkasse} />
              <Row l="IBAN" v={daten.iban ?? emp.iban} />
            </Group>
            <Group title="Arbeitswunsch">
              <Row l="Position" v={daten.position_typ ?? emp.position_typ} />
              <Row l="Vertragsart" v={daten.employment_type ?? emp.employment_type} />
              <Row l="Wunsch-Wochenstunden" v={daten.wochenstunden ?? emp.wochenstunden} />
            </Group>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Zuweisen</CardTitle></CardHeader>
          <CardContent>
            <AssignForm employee={emp} departments={deps ?? []} locations={locs ?? []} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="space-y-1 rounded-md border bg-muted/30 p-3">{children}</div>
    </div>
  );
}
function Row({ l, v }: { l: string; v: any }) {
  return <div className="flex justify-between text-sm"><span className="text-muted-foreground">{l}</span><span className="font-medium">{v || <Badge variant="muted">fehlt</Badge>}</span></div>;
}
