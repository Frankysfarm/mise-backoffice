import { redirect } from 'next/navigation';
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  LogOut,
  MapPin,
  Network,
  ListChecks,
  ReceiptText,
  Sparkles,
  UserRound,
  Warehouse,
} from 'lucide-react';
import { requirePosAccess } from '@/lib/auth/requireRole';
import { berlinScheduleMoment, isResponsibilityScheduleActive, type ResponsibilitySchedule } from '@/lib/operations/responsibility-scope';
import { createServiceClient } from '@/lib/supabase/server';
import { OnboardingGate, type OnboardingTraining } from './onboarding-gate';
import { PflichtHeute, type PflichtTask } from './pflicht-heute';
import {
  berlinWeekBounds,
  nextRelevantShift,
  shiftDurationMinutes,
  shiftTiming,
  shiftsInRange,
  totalShiftMinutes,
} from '@/lib/workforce/shifts';
import { MyOperations } from './my-operations';
import { AvailabilityLoop } from './availability-loop';
import { berlinScheduleWeek } from '@/lib/scheduling/berlin-week';

export const dynamic = 'force-dynamic';

type ShiftRow = {
  id: string;
  start_zeit: string;
  end_zeit: string;
  pause_minuten: number | null;
  status: string | null;
  position: string | null;
  typ: string | null;
  notiz: string | null;
  department: { name: string } | { name: string }[] | null;
  location: { name: string } | { name: string }[] | null;
};

type PublicationChangeRow = { shift_id: string | null; summary: string; changed_at: string };

type InventoryTaskRow = {
  id: string;
  notiz: string | null;
  area: { name: string } | { name: string }[] | null;
  location: { name: string } | { name: string }[] | null;
};

type TeamMemberRow = {
  id: string;
  vorname: string;
  nachname: string;
  rolle: string;
  position_title: string | null;
  reports_to_employee_id: string | null;
};

type ResponsibilityTeamRow = ResponsibilitySchedule & {
  id: string;
  department_id: string;
  employee_id: string;
  responsibility_role: string;
  employee: { vorname: string; nachname: string } | { vorname: string; nachname: string }[] | null;
};

type OwnResponsibilityRow = ResponsibilitySchedule & {
  id: string;
  responsibility_role: string;
  department: { id: string; name: string } | { id: string; name: string }[] | null;
};

const DATE = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long', day: '2-digit', month: 'long', timeZone: 'Europe/Berlin',
});
const TIME = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin',
});

function relationName(value: ShiftRow['location']): string | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0]?.name ?? null : value.name;
}

function personRelationName(value: ResponsibilityTeamRow['employee']): string {
  const person = Array.isArray(value) ? value[0] : value;
  return person ? `${person.vorname} ${person.nachname}` : 'Nicht zugeordnet';
}

function hoursLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} Std. ${rest} Min.` : `${hours} Std.`;
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    mitarbeiter: 'Mitarbeiter', teamleiter: 'Teamleitung', manager: 'Manager',
    backoffice: 'Backoffice', admin: 'Administration', server: 'Service',
    bartender: 'Bar', cook: 'Küche', dishwasher: 'Spülküche',
  };
  return labels[role] ?? role;
}

export default async function MitarbeiterPage() {
  const employee = await requirePosAccess();
  if (!employee.tenant_id) redirect('/login?reason=no_access');
  const employeeLocationId = employee.location_id ?? '00000000-0000-0000-0000-000000000000';

  const service = createServiceClient();
  const now = new Date();
  const rangeStart = new Date(now.getTime() - 14 * 86_400_000);
  const rangeEnd = new Date(now.getTime() + 60 * 86_400_000);

  const [
    { data: activeEmployee }, { data: shiftData }, { data: tenant }, { data: inventoryTaskData },
    { data: responsibilityData }, { data: operationalTaskData }, { data: handoverData },
    { data: teamMemberData }, { data: responsibilityTeamData }, { data: openShiftRows }, { data: availabilityResponseData }, { data: publicationChangeData }, { data: openWeekData },
  ] = await Promise.all([
    service.from('employees')
      .select('id,vorname,nachname,rolle,position_title,reports_to_employee_id,avatar_url,onboarding_completed_at,status')
      .eq('id', employee.id)
      .eq('tenant_id', employee.tenant_id)
      .in('status', ['aktiv', 'in_training', 'in_probe'])
      .maybeSingle(),
    service.from('shifts')
      .select('id,start_zeit,end_zeit,pause_minuten,status,position,typ,notiz,department:departments(name),location:locations(name)')
      .eq('employee_id', employee.id)
      .gte('end_zeit', rangeStart.toISOString())
      .lt('start_zeit', rangeEnd.toISOString())
      .order('start_zeit', { ascending: true }),
    service.from('tenants').select('name').eq('id', employee.tenant_id).maybeSingle(),
    service.from('inventory_sessions')
      .select('id,notiz,area:inventory_areas!inner(name,location:locations!inner(name,tenant_id)),location:locations(name)')
      .eq('assigned_to', employee.id)
      .is('abgeschlossen_am', null)
      .eq('area.location.tenant_id', employee.tenant_id)
      .order('created_at', { ascending: true }),
    service.from('department_responsibility_assignments')
      .select('id,responsibility_role,weekday_scope,shift_start,shift_end,valid_from,valid_until,department:departments(id,name)')
      .eq('tenant_id', employee.tenant_id).eq('location_id', employeeLocationId)
      .eq('employee_id', employee.id).eq('aktiv', true),
    service.from('operational_tasks')
      .select('id,shift_id,title,description,status,priority,due_at,completed_at,evidence_requirements,escalation_level,source_type,source_id,assigned_to,accountable_employee_id,controller_employee_id,department:departments(name),shift:shifts(start_zeit,end_zeit,position),evidence:operational_task_evidence(id,evidence_type,verification_status,submitted_at)')
      .eq('tenant_id', employee.tenant_id).eq('location_id', employeeLocationId)
      .or(`assigned_to.eq.${employee.id},accountable_employee_id.eq.${employee.id},controller_employee_id.eq.${employee.id}`)
      .not('status', 'eq', 'storniert').order('due_at', { ascending: true, nullsFirst: false }).limit(150),
    service.from('responsibility_handovers')
      .select('id,reason,starts_at,ends_at,note,status,read_at,confirmed_at,from_employee_id,to_employee_id,open_task_ids,incidents,inventory_notes,damage_notes,cleaning_notes,important_notes,department:departments(name),from_employee:employees!responsibility_handovers_from_employee_id_fkey(vorname,nachname),to_employee:employees!responsibility_handovers_to_employee_id_fkey(vorname,nachname)')
      .eq('tenant_id', employee.tenant_id).eq('location_id', employeeLocationId)
      .or(`from_employee_id.eq.${employee.id},to_employee_id.eq.${employee.id}`)
      .in('status', ['offen', 'gelesen', 'angenommen']).order('starts_at'),
    service.from('employees').select('id,vorname,nachname,rolle,position_title,reports_to_employee_id')
      .eq('tenant_id', employee.tenant_id).eq('location_id', employeeLocationId)
      .in('status', ['aktiv', 'in_training', 'in_probe']).order('nachname'),
    service.from('department_responsibility_assignments')
      .select('id,department_id,employee_id,responsibility_role,weekday_scope,shift_start,shift_end,valid_from,valid_until,employee:employees!department_responsibility_assignments_employee_id_fkey(vorname,nachname)')
      .eq('tenant_id', employee.tenant_id).eq('location_id', employeeLocationId)
      .eq('aktiv', true),
    service.from('shifts').select('id,start_zeit,end_zeit,position,department:departments(name)').eq('tenant_id', employee.tenant_id).eq('location_id', employeeLocationId).eq('offen_fuer_bewerbung', true).is('employee_id', null).gte('start_zeit', now.toISOString()).lt('start_zeit', rangeEnd.toISOString()).order('start_zeit'),
    service.from('shift_availability_responses').select('shift_id,state,applied').eq('tenant_id', employee.tenant_id).eq('employee_id', employee.id),
    service.from('schedule_publication_changes').select('shift_id,summary,changed_at').eq('tenant_id', employee.tenant_id).eq('employee_id', employee.id).neq('change_type', 'published').gte('changed_at', rangeStart.toISOString()).order('changed_at', { ascending: false }),
    service.from('schedule_weeks').select('week_start,availability_deadline').eq('tenant_id', employee.tenant_id).eq('location_id', employeeLocationId).eq('status', 'draft'),
  ]);

  const handoverTaskIds = [...new Set((handoverData ?? []).flatMap((handover) => handover.open_task_ids ?? []))];
  const { data: handedOverTasks } = handoverTaskIds.length
    ? await service.from('operational_tasks').select('id,title').eq('tenant_id', employee.tenant_id).eq('location_id', employeeLocationId).in('id', handoverTaskIds)
    : { data: [] };
  const handedOverTaskTitles = new Map((handedOverTasks ?? []).map((task) => [task.id, task.title]));
  const handoversWithTasks = (handoverData ?? []).map((handover) => ({
    ...handover,
    open_tasks: (handover.open_task_ids ?? []).map((id: string) => ({ id, title: handedOverTaskTitles.get(id) ?? 'Aufgabe aus der Übergabe' })),
  }));

  if (!activeEmployee) redirect('/login?reason=no_access');

  const shifts = (shiftData ?? []) as unknown as ShiftRow[];
  const relevant = nextRelevantShift(shifts, now);
  const upcoming = shifts.filter((shift) => Date.parse(shift.end_zeit) > now.getTime()).slice(0, 12);
  const bounds = berlinWeekBounds(now);
  const weekShifts = shiftsInRange(shifts, bounds.start, bounds.end);
  const inventoryTasks = (inventoryTaskData ?? []) as unknown as InventoryTaskRow[];
  const teamMembers = (teamMemberData ?? []) as unknown as TeamMemberRow[];
  const selfInTeam = teamMembers.find((person) => person.id === employee.id)
    ?? (activeEmployee as unknown as TeamMemberRow);
  const teamById = new Map(teamMembers.map((person) => [person.id, person]));
  const leadershipChain: TeamMemberRow[] = [];
  const seenLeaders = new Set<string>([employee.id]);
  let leaderId = selfInTeam.reports_to_employee_id;
  while (leaderId && !seenLeaders.has(leaderId) && leadershipChain.length < 8) {
    const leader = teamById.get(leaderId);
    if (!leader) break;
    leadershipChain.unshift(leader);
    seenLeaders.add(leader.id);
    leaderId = leader.reports_to_employee_id;
  }
  const directReports = teamMembers.filter((person) => person.reports_to_employee_id === employee.id);
  const scheduleMoment = berlinScheduleMoment(now);
  const ownResponsibilities = ((responsibilityData ?? []) as unknown as OwnResponsibilityRow[])
    .filter((item) => isResponsibilityScheduleActive(item, scheduleMoment));
  const ownDepartmentIds = new Set(ownResponsibilities.flatMap((item) => {
    const department = Array.isArray(item.department) ? item.department[0] : item.department;
    return department?.id ? [department.id] : [];
  }));
  const responsibilityCoverage = ((responsibilityTeamData ?? []) as unknown as ResponsibilityTeamRow[])
    .filter((item) => ownDepartmentIds.has(item.department_id) && isResponsibilityScheduleActive(item, scheduleMoment))
    .map((item) => ({
      id: item.id,
      department_id: item.department_id,
      employee_id: item.employee_id,
      responsibility_role: item.responsibility_role,
      employee_name: personRelationName(item.employee),
    }));
  const name = [employee.vorname, employee.nachname].filter(Boolean).join(' ') || 'Mitarbeiter';
  const canOpenBackoffice = ['manager', 'backoffice', 'admin'].includes(employee.rolle);

  // Onboarding-Sperre: neue Mitarbeiter sehen nur ihre Pflichtschulungen, bis alle bestanden sind.
  // (Trigger training_progress_onboarding_complete setzt onboarding_completed_at und schaltet frei.)
  const onboardingState = activeEmployee as { onboarding_completed_at?: string | null; status?: string | null };
  if (!canOpenBackoffice && (onboardingState.status === 'in_training' || !onboardingState.onboarding_completed_at)) {
    const { data: mandatoryRows, error: mandatoryError } = await service
      .from('training_progress')
      .select('id,status,due_at,fortschritt_prozent,module:training_modules!inner(titel,dauer_minuten,pflicht,aktiv)')
      .eq('employee_id', employee.id)
      .eq('tenant_id', employee.tenant_id)
      .eq('module.pflicht', true)
      .eq('module.aktiv', true)
      .order('due_at', { ascending: true, nullsFirst: false });
    // Fail-closed: bei Datenbankfehler lieber den Onboarding-Modus zeigen als die volle App freigeben
    if (mandatoryError) throw new Error(`Onboarding-Status konnte nicht geladen werden (${mandatoryError.code ?? 'db'})`);
    const mandatory = (mandatoryRows ?? []) as unknown as OnboardingTraining[];
    if (mandatory.some((t) => t.status !== 'bestanden')) {
      return <OnboardingGate vorname={employee.vorname || 'du'} tenantName={tenant?.name ?? 'Mein Betrieb'} trainings={mandatory} />;
    }
  }

  // Pflicht-Checklisten der Schicht: eigene Sektion, nicht in der allgemeinen Aufgabenliste doppelt
  const allOperationalTasks = (operationalTaskData ?? []) as unknown as (PflichtTask & { assigned_to?: string | null })[];
  const isOwnOpenGuideTask = (task: PflichtTask & { assigned_to?: string | null }) => task.source_type === 'shift_guide' && task.assigned_to === employee.id && ['offen', 'angenommen', 'in_arbeit'].includes(task.status);
  const pflichtTasks = allOperationalTasks.filter(isOwnOpenGuideTask);
  const generalOperationalTasks = allOperationalTasks.filter((task) => !isOwnOpenGuideTask(task));
  const changesByShift = new Map(((publicationChangeData ?? []) as PublicationChangeRow[]).flatMap(change => change.shift_id ? [[change.shift_id, change] as const] : []));
  const openWeeks = new Set((openWeekData ?? []).filter(week => !week.availability_deadline || Date.parse(week.availability_deadline) >= now.getTime()).map(week => week.week_start));
  const openShiftData = (openShiftRows ?? []).filter(shift => openWeeks.has(berlinScheduleWeek(undefined, new Date(shift.start_zeit)).calendarStart));

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto min-h-screen max-w-5xl bg-slate-100 pb-12">
        <header className="relative overflow-hidden bg-slate-950 px-5 pb-24 pt-[max(1.25rem,env(safe-area-inset-top))] text-white sm:px-8">
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 ring-1 ring-emerald-400/40">
                <span className="h-4 w-4 rounded-sm border-2 border-white" />
              </div>
              <div>
                <div className="text-lg font-bold tracking-tight">mise team</div>
                <div className="text-xs text-slate-300">{tenant?.name ?? 'Mein Betrieb'}</div>
              </div>
            </div>
            <a href="/mitarbeiter/profil" className="inline-flex h-11 w-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/15 sm:w-auto">
              <UserRound size={15} /> <span className="hidden sm:inline">Profil</span>
            </a>
            <form action="/auth/signout" method="post">
              <button className="inline-flex h-11 w-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/15 sm:w-auto" type="submit">
                <LogOut size={15} /> <span className="hidden sm:inline">Abmelden</span>
              </button>
            </form>
          </div>

          <div className="relative mt-10">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-emerald-300">
              <Sparkles size={13} /> Mein Arbeitstag
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Hallo {employee.vorname || name}</h1>
            <p className="mt-2 text-sm text-slate-300">{roleLabel(employee.rolle)} · deine Schichten auf einen Blick</p>
          </div>
        </header>

        <section className="relative -mt-16 px-4 sm:px-8" aria-label="Nächste Schicht">
          <div className="rounded-3xl border border-white/70 bg-white p-5 shadow-xl shadow-slate-950/10 sm:p-6">
            {relevant ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[.14em] text-emerald-700">
                      {shiftTiming(relevant, now) === 'active' ? 'Schicht läuft jetzt' : 'Nächste Schicht'}
                    </div>
                    <h2 className="mt-2 text-2xl font-bold capitalize tracking-tight">{DATE.format(new Date(relevant.start_zeit))}</h2>
                  </div>
                  <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${shiftTiming(relevant, now) === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                    {shiftTiming(relevant, now) === 'active' ? 'Aktiv' : 'Geplant'}
                  </span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <Info icon={<Clock3 size={17} />} label="Uhrzeit" value={`${TIME.format(new Date(relevant.start_zeit))}–${TIME.format(new Date(relevant.end_zeit))}`} />
                  <Info icon={<BriefcaseBusiness size={17} />} label="Einsatz" value={relevant.position || relationName(relevant.department) || 'Schicht'} />
                  <Info icon={<MapPin size={17} />} label="Standort" value={relationName(relevant.location) || 'Noch nicht angegeben'} />
                </div>
                {relevant.notiz && <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-950">Hinweis: {relevant.notiz}</p>}
              </>
            ) : (
              <div className="py-3 text-center">
                <CheckCircle2 className="mx-auto text-emerald-600" size={30} />
                <h2 className="mt-3 text-xl font-bold">Keine Schicht geplant</h2>
                <p className="mt-1 text-sm text-slate-500">Für die nächsten 60 Tage ist noch nichts eingetragen.</p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 grid gap-4 px-4 sm:grid-cols-3 sm:px-8">
          <Metric label="Schichten diese Woche" value={String(weekShifts.length)} />
          <Metric label="Arbeitszeit diese Woche" value={hoursLabel(totalShiftMinutes(weekShifts))} />
          <Metric label="Kommende Schichten" value={String(upcoming.length)} />
        </section>

        <nav className="sticky top-0 z-30 mt-6 flex gap-2 overflow-x-auto border-y border-slate-200 bg-slate-100/95 px-4 py-2 shadow-sm backdrop-blur sm:px-8" aria-label="Mise Team Bereiche">
          <a href="#dienstplan" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200"><CalendarDays size={14} className="text-emerald-700" /> Dienstplan</a>
          <a href="#verfuegbarkeit" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200"><Sparkles size={14} className="text-sky-700" /> Verfügbarkeit</a>
          <a href="#verantwortung" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200"><Network size={14} className="text-indigo-700" /> Mein Team</a>
          <a href="#meine-aufgaben" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200"><ClipboardCheck size={14} className="text-amber-700" /> Aufgaben</a>
          <a href="#ablaeufe" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200"><ListChecks size={14} className="text-indigo-700" /> Abläufe</a>
          <a href="#inventuren" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200"><Warehouse size={14} className="text-amber-700" /> Inventuren</a>
          <a href="/mitarbeiter/schulungen" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200"><Sparkles size={14} className="text-indigo-700" /> Schulungen</a>
        </nav>

        <PflichtHeute tasks={pflichtTasks} now={now} />

        <section id="dienstplan" className="mt-8 scroll-mt-20 px-4 sm:px-8">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-[.14em] text-emerald-700">Dienstplan</div>
              <h2 className="mt-1 text-xl font-bold tracking-tight">Meine nächsten Schichten</h2>
            </div>
            <CalendarDays className="text-slate-400" size={22} />
          </div>
          <div className="space-y-3">
            {upcoming.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-500">Noch keine kommenden Schichten.</div>}
            {upcoming.map((shift) => (
              <article key={shift.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-800">
                  <div className="text-center"><div className="text-lg font-extrabold leading-none">{new Date(shift.start_zeit).toLocaleDateString('de-DE', { day: '2-digit', timeZone: 'Europe/Berlin' })}</div><div className="mt-1 text-[10px] font-bold uppercase">{new Date(shift.start_zeit).toLocaleDateString('de-DE', { month: 'short', timeZone: 'Europe/Berlin' })}</div></div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold capitalize">{DATE.format(new Date(shift.start_zeit))}</div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                    <span>{TIME.format(new Date(shift.start_zeit))}–{TIME.format(new Date(shift.end_zeit))}</span>
                    <span>{hoursLabel(shiftDurationMinutes(shift))}</span>
                    {relationName(shift.location) && <span>{relationName(shift.location)}</span>}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                  {changesByShift.has(shift.id) && <div className="mb-1 inline-flex rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800" title={changesByShift.get(shift.id)?.summary}>Geändert seit Veröffentlichung</div>}
                  <div className="text-sm font-semibold text-slate-800">{shift.position || relationName(shift.department) || 'Schicht'}</div>
                  <div className="mt-1 text-xs text-slate-400">{shift.status || 'geplant'}</div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <AvailabilityLoop shifts={(openShiftData ?? []) as never[]} initial={(availabilityResponseData ?? []) as never[]} />

        <MyOperations
          actorId={employee.id}
          locationId={employee.location_id ?? ''}
          responsibilities={ownResponsibilities as never[]}
          tasks={generalOperationalTasks as never[]}
          handovers={handoversWithTasks as never[]}
          organization={{ self: selfInTeam, leaders: leadershipChain, directReports }}
          responsibilityCoverage={responsibilityCoverage}
        />

        <section id="ablaeufe" className="mt-8 scroll-mt-20 px-4 sm:px-8">
          {canOpenBackoffice ? (
            <a href="/neo/app/ablaeufe/schichtleitfaeden" className="group flex items-center gap-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-950 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-100">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-100"><ListChecks size={20} /></span>
              <span className="min-w-0 flex-1"><span className="block font-bold">Öffnung, Schließung & Abläufe</span><span className="mt-0.5 block text-xs text-indigo-700">Geführte Checklisten für deinen Standort starten</span></span>
              <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
            </a>
          ) : (
            // Mitarbeiter starten Abläufe aus ihrer Schicht (Leitfaden-Liste ist Verwaltung, Middleware sperrt sie).
            <div className="flex items-center gap-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-950">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-100"><ListChecks size={20} /></span>
              <span className="min-w-0 flex-1"><span className="block font-bold">Öffnung, Schließung & Abläufe</span><span className="mt-0.5 block text-xs text-indigo-700">Deine Schichtleitung startet den Ablauf – die Schritte erscheinen dann in deiner Schicht unter „Meine nächsten Schichten“.</span></span>
            </div>
          )}
        </section>

        <section id="inventuren" className="mt-8 scroll-mt-20 px-4 sm:px-8" aria-labelledby="inventory-tasks-title">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-[.14em] text-amber-700">Lageraufgaben</div>
              <h2 id="inventory-tasks-title" className="mt-1 text-xl font-bold tracking-tight">Meine Inventuren</h2>
            </div>
            <Warehouse className="text-slate-400" size={22} />
          </div>
          {inventoryTasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6 text-center text-sm text-slate-500">
              Aktuell ist dir keine Inventur zugewiesen.
            </div>
          ) : (
            <div className="space-y-3">
              {inventoryTasks.map((task) => (
                <a key={task.id} href={`/mitarbeiter/inventur/${task.id}`}
                  className="group flex items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm transition hover:border-amber-300 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-200/70"><Warehouse size={20} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{relationName(task.area) || 'Inventur'}</span>
                    <span className="mt-0.5 block text-xs text-amber-800">{relationName(task.location) || 'Lagerbereich'}{task.notiz ? ` · ${task.notiz}` : ''}</span>
                  </span>
                  <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                </a>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 grid gap-3 px-4 sm:grid-cols-2 sm:px-8">
          <a href="/pos" className="group flex items-center gap-4 rounded-2xl bg-slate-950 p-4 text-white shadow-lg shadow-slate-950/10">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10"><ReceiptText size={20} /></span>
            <span className="flex-1"><span className="block font-bold">Kasse & Betrieb</span><span className="text-xs text-slate-300">Zum freigegebenen Arbeitsbereich</span></span>
            <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
          </a>
          {canOpenBackoffice && (
            <a href="/neo" className="group flex items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-100"><BriefcaseBusiness size={20} /></span>
              <span className="flex-1"><span className="block font-bold">Backoffice</span><span className="text-xs text-emerald-700">Team und Betrieb verwalten</span></span>
              <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
            </a>
          )}
        </section>
      </div>
    </main>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3"><span className="text-emerald-700">{icon}</span><span><span className="block text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</span><span className="mt-0.5 block text-sm font-semibold text-slate-800">{value}</span></span></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4"><div className="text-xl font-extrabold tracking-tight text-slate-950">{value}</div><div className="mt-1 text-xs font-medium text-slate-500">{label}</div></div>;
}
