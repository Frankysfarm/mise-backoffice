import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RoleBadge, StatusBadge } from '@/components/role-badge';
import { dateDE, dateTimeDE } from '@/lib/utils';
import { notFound } from 'next/navigation';
import { EditEmployeeForm } from './edit-form';
import { InviteButton } from './invite-button';
import { ProbeReview } from './probe-review';
import { AvailabilityEditor } from './availability-editor';
import { DocumentUploader } from './document-uploader';

export default async function EmployeeDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireManagerPlus();
  const { id } = await params;
  const supabase = await createClient();

  const { data: emp } = await supabase.from('employees')
    .select('*, department:departments(id,name), location:locations(id,name)')
    .eq('id', id).maybeSingle();
  if (!emp) notFound();

  const [{ data: shifts }, { data: trainingRaw }, { data: docs }, { data: badges }, { data: locations }, { data: departments }, { data: probeShifts }, { data: review }, { data: availRaw }, { data: excRaw }] = await Promise.all([
    supabase.from('shifts').select('start_zeit,end_zeit,status,position,typ').eq('employee_id', id).order('start_zeit', { ascending: false }).limit(30),
    supabase.from('training_progress').select('*,module:training_modules(titel,kategorie)').eq('employee_id', id),
    supabase.from('documents').select('id,titel,kategorie,ablaufdatum').eq('employee_id', id).order('created_at', { ascending: false }),
    supabase.from('employee_badges').select('verliehen_am,badge:badges(name,icon,punkte)').eq('employee_id', id),
    supabase.from('locations').select('id,name').order('name'),
    supabase.from('departments').select('id,name').order('name'),
    supabase.from('shifts').select('id,start_zeit,end_zeit').eq('employee_id', id).eq('typ', 'probe').order('start_zeit', { ascending: false }),
    supabase.from('performance_reviews').select('*').eq('employee_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('employee_availability').select('*').eq('employee_id', id),
    supabase.from('availability_exceptions').select('*').eq('employee_id', id).gte('datum', new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)),
  ]);
  const training = trainingRaw as any[] | null;
  const showProbe = ['in_probe', 'in_training'].includes(emp.status) || (probeShifts?.length ?? 0) > 0;

  return (
    <div>
      <PageHeader
        backHref="/employees"
        title={`${emp.vorname} ${emp.nachname}`}
        description={<>
          <RoleBadge rolle={emp.rolle} /> <StatusBadge status={emp.status} />
        </> as unknown as string}
        actions={<InviteButton employeeId={emp.id} email={emp.email} alreadyLinked={!!emp.auth_user_id} />}
      />

      <Tabs defaultValue={showProbe ? 'probe' : 'profil'}>
        <TabsList>
          <TabsTrigger value="profil">Profil</TabsTrigger>
          <TabsTrigger value="schichten">Schichten ({shifts?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="verfuegbarkeit">Verfügbarkeit</TabsTrigger>
          {showProbe && <TabsTrigger value="probe">🎓 Probezeit</TabsTrigger>}
          <TabsTrigger value="training">Training ({training?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="dokumente">Dokumente ({docs?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="badges">Badges ({badges?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="profil">
          <EditEmployeeForm employee={emp} locations={locations ?? []} departments={departments ?? []} />
        </TabsContent>

        <TabsContent value="schichten">
          <Card>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Start</TableHead><TableHead>Ende</TableHead>
                <TableHead>Position</TableHead><TableHead>Typ</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {shifts?.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell>{dateTimeDE(s.start_zeit)}</TableCell>
                    <TableCell>{dateTimeDE(s.end_zeit)}</TableCell>
                    <TableCell>{s.position ?? '—'}</TableCell>
                    <TableCell>{(s as any).typ === 'probe' ? '🎓 Probe' : (s as any).typ === 'einarbeitung' ? '🌱 Einarbeitung' : '—'}</TableCell>
                    <TableCell>{s.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="verfuegbarkeit">
          <AvailabilityEditor
            employeeId={emp.id}
            availabilities={(availRaw as any[]) ?? []}
            exceptions={(excRaw as any[]) ?? []}
          />
        </TabsContent>

        {showProbe && (
          <TabsContent value="probe">
            <ProbeReview
              employeeId={emp.id}
              probeShifts={(probeShifts as any[]) ?? []}
              existingReview={review}
            />
          </TabsContent>
        )}

        <TabsContent value="training">
          <Card>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Modul</TableHead><TableHead>Kategorie</TableHead>
                <TableHead>Fortschritt</TableHead><TableHead>Test</TableHead>
                <TableHead>Gültig bis</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {training?.map((t, i) => {
                  const m = t.module as any;
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{m?.titel}</TableCell>
                      <TableCell>{m?.kategorie}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 rounded-full bg-muted"><div className="h-full rounded-full bg-matcha-600" style={{ width: `${t.fortschritt_prozent}%` }} /></div>
                          <span className="text-xs">{t.fortschritt_prozent}%</span>
                        </div>
                      </TableCell>
                      <TableCell>{t.testergebnis ?? '—'}</TableCell>
                      <TableCell>{dateDE(t.gültig_bis)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="dokumente">
          <div className="space-y-4">
            <DocumentUploader employeeId={emp.id} />
            <Card>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Titel</TableHead><TableHead>Kategorie</TableHead><TableHead>Ablauf</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {docs?.map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.titel}</TableCell>
                      <TableCell>{d.kategorie ?? '—'}</TableCell>
                      <TableCell>{dateDE(d.ablaufdatum)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="badges">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {badges?.map((b, i) => {
              const badge = b.badge as any;
              return (
                <Card key={i}>
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl">{badge?.icon}</div>
                    <div className="mt-2 font-medium">{badge?.name}</div>
                    <div className="text-xs text-muted-foreground">{badge?.punkte} Punkte</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{dateDE(b.verliehen_am)}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
