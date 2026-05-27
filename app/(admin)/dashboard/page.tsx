import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, Sparkles, CheckSquare, Banknote, Package, GraduationCap, UserCheck } from 'lucide-react';
import { dateTimeDE } from '@/lib/utils';
import { LiveRefresh } from '@/components/live-refresh';

export default async function DashboardPage() {
  await requireManagerPlus();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const nowISO = new Date().toISOString();
  const [
    { count: mitarbeiter },
    { count: schichten_heute },
    { count: offene_schichten },
    { count: cleaning_heute },
    { count: checkups_heute },
    { count: notifications },
    { count: bewerbungen },
    { data: letzteStempel },
    { data: probeReportDue },
  ] = await Promise.all([
    supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'aktiv'),
    supabase.from('shifts').select('id', { count: 'exact', head: true }).gte('start_zeit', `${today}T00:00:00Z`).lte('start_zeit', `${today}T23:59:59Z`),
    supabase.from('shifts').select('id', { count: 'exact', head: true }).is('employee_id', null),
    supabase.from('cleaning_completions').select('id', { count: 'exact', head: true }).eq('completed_date', today),
    supabase.from('checkup_completions').select('id', { count: 'exact', head: true }).gte('created_at', `${today}T00:00:00Z`),
    supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('gelesen', false),
    supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'wartet_zuteilung'),
    supabase.from('stamps').select('zeitstempel,typ,employee:employees!stamps_employee_id_fkey(vorname,nachname)').order('zeitstempel', { ascending: false }).limit(8),
    // Mitarbeiter mit ≥3 abgeschlossenen Probeschichten und KEINEM performance_review
    supabase.rpc('dashboard_probe_report_due').select('*') as unknown as Promise<{ data: any[] | null }>,
  ]);

  const stats = [
    { icon: Users,      label: 'Aktive Mitarbeiter',   value: mitarbeiter ?? 0 },
    { icon: Clock,      label: 'Schichten heute',      value: schichten_heute ?? 0 },
    { icon: Users,      label: 'Unbesetzte Schichten', value: offene_schichten ?? 0, warn: (offene_schichten ?? 0) > 0 },
    { icon: Sparkles,   label: 'Reinigungen heute',    value: cleaning_heute ?? 0 },
    { icon: CheckSquare,label: 'Check-ups heute',      value: checkups_heute ?? 0 },
    { icon: Banknote,   label: 'Ungelesene Meldungen', value: notifications ?? 0 },
  ];

  return (
    <div className="space-y-8">
      <LiveRefresh channel="dashboard-stamps" table="stamps" />
      <LiveRefresh channel="dashboard-cleaning" table="cleaning_completions" />
      <LiveRefresh channel="dashboard-checkups" table="checkup_completions" />
      <PageHeader title="Dashboard" description="Schnappschuss deines Tages — aktualisiert sich live." />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {stats.map(s => (
          <Card key={s.label} className={s.warn ? 'border-destructive/40' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className={`h-4 w-4 ${s.warn ? 'text-destructive' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className={`font-display text-3xl font-bold ${s.warn ? 'text-destructive' : ''}`}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {((bewerbungen ?? 0) > 0 || (probeReportDue?.length ?? 0) > 0) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {(bewerbungen ?? 0) > 0 && (
            <Card className="border-gold/60 bg-gold-soft/30">
              <CardContent className="flex items-start gap-3 p-4">
                <UserCheck className="mt-0.5 h-5 w-5 text-gold" />
                <div className="flex-1">
                  <div className="font-semibold">{bewerbungen} Bewerbung(en) warten auf Zuteilung</div>
                  <p className="text-sm text-muted-foreground">Prüfe Daten und weise Abteilung zu, damit Training automatisch startet.</p>
                </div>
                <Link href="/applications"><Badge>Öffnen →</Badge></Link>
              </CardContent>
            </Card>
          )}
          {(probeReportDue?.length ?? 0) > 0 && (
            <Card className="border-matcha-300 bg-matcha-50">
              <CardContent className="flex items-start gap-3 p-4">
                <GraduationCap className="mt-0.5 h-5 w-5 text-matcha-700" />
                <div className="flex-1">
                  <div className="font-semibold">{probeReportDue!.length} Probe-Bericht(e) fällig</div>
                  <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                    {probeReportDue!.slice(0, 3).map((p: any) => (
                      <li key={p.id}>
                        <Link href={`/employees/${p.id}`} className="hover:underline">
                          {p.vorname} {p.nachname} — {p.probe_count} Schicht(en)
                        </Link>
                      </li>
                    ))}
                    {probeReportDue!.length > 3 && <li>+ {probeReportDue!.length - 3} weitere</li>}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Letzte Stempel</CardTitle>
        </CardHeader>
        <CardContent>
          {(letzteStempel?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Stempel erfasst.</p>
          ) : (
            <ul className="divide-y">
              {letzteStempel!.map((s, i) => {
                const e = s.employee as { vorname?: string; nachname?: string } | null;
                return (
                  <li key={i} className="flex items-center justify-between py-2">
                    <div>
                      <span className="font-medium">{e?.vorname} {e?.nachname}</span>
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">{s.typ}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{dateTimeDE(s.zeitstempel)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
