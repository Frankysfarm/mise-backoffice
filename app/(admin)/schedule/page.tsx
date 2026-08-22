import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ScheduleWeek } from './week-view';
import { NewShiftDialog } from './new-shift-dialog';
import { operationsBasePath } from '@/lib/routing/operations-base-path';

function parseWeek(param?: string): Date {
  if (param) {
    const d = new Date(param);
    if (!isNaN(d.getTime())) return startOfWeekMonday(d);
  }
  return startOfWeekMonday(new Date());
}
function startOfWeekMonday(d: Date) {
  const r = new Date(d);
  const day = (r.getDay() + 6) % 7;
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - day);
  return r;
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

type SchedulePageProps = { searchParams: Promise<{ week?: string; location?: string }> };

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  const currentEmployee = await requireManagerPlus();
  if (!currentEmployee.tenant_id) throw new Error('Mitarbeiterkonto ist keinem Mandanten zugeordnet.');
  const basePath = await operationsBasePath('/schedule', '/neo/app/dienstplan');
  const params = await searchParams;
  const supabase = await createClient();

  const weekStart = parseWeek(params.week);
  const weekEnd = addDays(weekStart, 7);
  const prev = isoDate(addDays(weekStart, -7));
  const next = isoDate(addDays(weekStart, 7));
  const today = isoDate(new Date());

  let q = supabase.from('shifts')
    .select('id,start_zeit,end_zeit,status,position,pause_minuten,employee_id,department_id,location_id,typ,notiz,offen_fuer_bewerbung,employee:employees!shifts_employee_id_fkey(id,vorname,nachname,rolle,geburtsdatum,wochenstunden),department:departments(name,farbe),location:locations(name)')
    .gte('start_zeit', weekStart.toISOString())
    .lt('start_zeit', weekEnd.toISOString())
    .order('start_zeit');
  if (params.location) q = q.eq('location_id', params.location);
  const { data: shiftsRaw } = await q;
  const shifts = shiftsRaw as any[] | null;

  const [{ data: locations }, { data: departments }, { data: employees }, { data: swaps }] = await Promise.all([
    supabase.from('locations').select('id,name').eq('tenant_id', currentEmployee.tenant_id).order('name'),
    supabase
      .from('departments')
      .select('id,name,location:locations!inner(tenant_id)')
      .eq('location.tenant_id', currentEmployee.tenant_id)
      .order('name'),
    supabase
      .from('employees')
      .select('id,vorname,nachname')
      .eq('tenant_id', currentEmployee.tenant_id)
      .eq('status', 'aktiv')
      .order('nachname'),
    supabase.from('shift_swaps').select('id,status').eq('status', 'angefragt'),
  ]);

  return (
    <div>
      <PageHeader
        title="Dienstplan"
        description={`Woche ab ${weekStart.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}. ${shifts?.length ?? 0} Schichten.`}
        actions={<>
          <Link href={`${basePath}/templates`}>
            <Button variant="outline">Vorlagen</Button>
          </Link>
          <Link
            href={`/api/pdf/schedule?week=${isoDate(weekStart)}${params.location ? `&location=${params.location}` : ''}`}
          >
            <Button variant="outline">📄 PDF</Button>
          </Link>
          {(swaps?.length ?? 0) > 0 && (
            <Link href={`${basePath}/swap-requests`}>
              <Button variant="outline">{swaps!.length} Tauschanfragen</Button>
            </Link>
          )}
          <NewShiftDialog
            employees={employees ?? []}
            departments={(departments ?? []).map(({ id, name }) => ({ id, name }))}
            locations={locations ?? []}
            defaultDate={today}
          />
        </>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`${basePath}?week=${prev}${params.location ? `&location=${params.location}` : ''}`}><Button variant="outline" size="sm">← Vorherige Woche</Button></Link>
        <Link href={basePath}><Button variant="ghost" size="sm">Heute</Button></Link>
        <Link href={`${basePath}?week=${next}${params.location ? `&location=${params.location}` : ''}`}><Button variant="outline" size="sm">Nächste Woche →</Button></Link>
        <form className="ml-auto flex items-center gap-2">
          <input type="hidden" name="week" value={isoDate(weekStart)} />
          <select name="location" defaultValue={params.location ?? ''} className="h-9 rounded-md border bg-background px-2 text-sm">
            <option value="">Alle Standorte</option>
            {locations?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <Button type="submit" variant="outline" size="sm">Anwenden</Button>
        </form>
      </div>

      <Card>
        <ScheduleWeek
          weekStart={weekStart}
          initialShifts={(shifts ?? []) as any}
          employees={employees ?? []}
          departments={(departments ?? []).map(({ id, name }) => ({ id, name }))}
          locations={locations ?? []}
        />
      </Card>

      <div className="mt-4 flex flex-wrap gap-3 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
        <span>💡 Schichten per Drag-and-Drop zwischen Tagen verschieben (Uhrzeit bleibt).</span>
        <span>🟥 Rot = ArbZG-Verstoß · 🟡 Gelb = Warnung</span>
      </div>
    </div>
  );
}
