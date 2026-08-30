'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useTransition } from 'react';
import {
  AlertTriangle, CalendarClock, CheckCircle2, Clock, Users,
} from 'lucide-react';
import styles from './klarheit.module.css';

type Department = { id: string; name: string; aktiv: boolean; prioritaet: number };
type Employee = {
  id: string; vorname: string; nachname: string; rolle: string; position_title: string | null; department_id: string | null;
};
type Person = { id?: string; vorname: string; nachname: string; rolle?: string; position_title?: string | null };
type Shift = {
  id: string; start_zeit: string; end_zeit: string; status: string | null; position: string | null; typ: string | null;
  employee: Person | Person[] | null;
  department: { id: string; name: string } | { id: string; name: string }[] | null;
};
type Task = {
  id: string; department_id: string | null; title: string; status: string; priority: number;
  due_at: string | null; escalation_level: number; assigned_to: string | null;
  assignee: { vorname: string; nachname: string } | { vorname: string; nachname: string }[] | null;
};
type Coverage = {
  department_id: string; name: string; prioritaet: number;
  hauptverantwortlicher_id: string | null; stellvertretung_id: string | null;
  aktuell_zustaendig_id: string | null; hauptverantwortlicher_abwesend: boolean; abdeckungsstatus: string;
};
type Absence = {
  id: string; employee_id: string; datum: string; typ: string;
  employee: Person | Person[] | null;
};
type Location = { id: string; name: string; stadt: string | null };

const TASK_OPEN = new Set(['offen', 'angenommen', 'in_arbeit', 'wartet_auf_pruefung', 'blockiert']);
const TASK_LABELS: Record<string, string> = {
  offen: 'Offen', angenommen: 'Angenommen', in_arbeit: 'In Arbeit', wartet_auf_pruefung: 'Prüfung offen',
  erledigt: 'Freigegeben', nicht_bestanden: 'Nicht bestanden', blockiert: 'Blockiert', storniert: 'Storniert',
};
const COVERAGE_LABELS: Record<string, string> = {
  hauptverantwortung_fehlt: 'Hauptverantwortung fehlt',
  stellvertretung_fehlt: 'Stellvertretung fehlt',
  vertretung_waehrend_abwesenheit_fehlt: 'Vertretung bei Abwesenheit fehlt',
  aktive_vertretung: 'Vertretung ist aktiv',
  abgedeckt: 'Vollständig abgedeckt',
};
const ABSENCE_LABELS: Record<string, string> = {
  krank: 'Krank', urlaub: 'Urlaub', abwesend: 'Abwesend', gesperrt: 'Gesperrt',
  nicht_verfuegbar: 'Nicht verfügbar', unavailable: 'Nicht verfügbar', sick: 'Krank',
};
const ROLE_LABELS: Record<string, string> = {
  mitarbeiter: 'Mitarbeiter', teamleiter: 'Teamleitung', manager: 'Manager',
  backoffice: 'Backoffice', admin: 'Administration', server: 'Service',
  bartender: 'Bar', cook: 'Küche', dishwasher: 'Spülküche',
};

const DATE = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long', day: '2-digit', month: 'long', timeZone: 'Europe/Berlin',
});
const TIME = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin',
});
const SHORT_DATE = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit', month: 'short', timeZone: 'Europe/Berlin',
});

function relationName<T extends { name: string }>(value: T | T[] | null): string | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0]?.name ?? null : value.name;
}

function personName(value: Person | Person[] | null): string | null {
  if (!value) return null;
  const p = Array.isArray(value) ? value[0] : value;
  return p ? `${p.vorname} ${p.nachname}` : null;
}

function roleLabel(role: string | undefined): string {
  if (!role) return 'Mitarbeiter';
  return ROLE_LABELS[role] ?? role;
}

function shiftTiming(shift: Shift, now: number): 'active' | 'upcoming' | 'completed' {
  const start = Date.parse(shift.start_zeit);
  const end = Date.parse(shift.end_zeit);
  if (now < start) return 'upcoming';
  if (now < end) return 'active';
  return 'completed';
}

function hoursLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} Std. ${rest} Min.` : `${hours} Std.`;
}

function shiftDurationMinutes(shift: Shift): number {
  const start = Date.parse(shift.start_zeit);
  const end = Date.parse(shift.end_zeit);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.max(0, Math.round((end - start) / 60_000));
}

export function KlarheitClient({
  locationId, locations, canSelectLocation,
  departments, employees, shifts, tasks, coverage, absences,
  todayDate, todayEnd, now,
}: {
  actorId: string; locationId: string; locations: Location[]; canSelectLocation: boolean;
  departments: Department[]; employees: Employee[]; shifts: Shift[]; tasks: Task[];
  coverage: Coverage[]; absences: Absence[]; todayDate: string; todayEnd: string; now: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const nowMs = useMemo(() => new Date(now).getTime(), [now]);
  const todayEndMs = useMemo(() => new Date(todayEnd).getTime(), [todayEnd]);

  const departmentById = useMemo(() => {
    const map = new Map<string, Department>();
    for (const d of departments) map.set(d.id, d);
    return map;
  }, [departments]);

  const employeeById = useMemo(() => {
    const map = new Map<string, Employee>();
    for (const e of employees) map.set(e.id, e);
    return map;
  }, [employees]);

  const shiftsByDepartment = useMemo(() => {
    const grouped = new Map<string, Shift[]>();
    const unassigned: Shift[] = [];
    for (const shift of shifts) {
      const dept = shift.department ? (Array.isArray(shift.department) ? shift.department[0] : shift.department) : null;
      if (dept?.id && departmentById.has(dept.id)) {
        grouped.set(dept.id, [...(grouped.get(dept.id) ?? []), shift]);
      } else {
        unassigned.push(shift);
      }
    }
    return { grouped, unassigned };
  }, [shifts, departmentById]);

  const sortedDepartmentIds = useMemo(() => {
    const ids = departments
      .filter((d) => (shiftsByDepartment.grouped.get(d.id)?.length ?? 0) > 0)
      .sort((a, b) => b.prioritaet - a.prioritaet || a.name.localeCompare(b.name))
      .map((d) => d.id);
    return ids;
  }, [departments, shiftsByDepartment]);

  const openTasks = useMemo(() => tasks.filter((t) => TASK_OPEN.has(t.status)), [tasks]);
  const overdueTasks = useMemo(() => openTasks.filter((t) => t.due_at && Date.parse(t.due_at) < nowMs), [openTasks, nowMs]);
  const dueTodayTasks = useMemo(() => openTasks.filter((t) => t.due_at && Date.parse(t.due_at) >= nowMs && Date.parse(t.due_at) <= todayEndMs), [openTasks, nowMs, todayEndMs]);

  const taskCountsByDepartment = useMemo(() => {
    const counts = new Map<string, { total: number; overdue: number }>();
    for (const t of openTasks) {
      const id = t.department_id ?? 'unassigned';
      const current = counts.get(id) ?? { total: 0, overdue: 0 };
      current.total += 1;
      if (t.due_at && Date.parse(t.due_at) < nowMs) current.overdue += 1;
      counts.set(id, current);
    }
    return counts;
  }, [openTasks, nowMs]);

  const changeLocation = (next: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (next) params.set('location', next);
    else params.delete('location');
    startTransition(() => { router.push(`/neo/app/klarheit?${params.toString()}`); });
  };

  const currentLocation = locations.find((l) => l.id === locationId);
  const headerDate = useMemo(() => {
    try { return DATE.format(new Date(`${todayDate}T12:00:00Z`)); }
    catch { return todayDate; }
  }, [todayDate]);

  return (
    <div className={styles.module}>
      <header className={styles.hero}>
        <div className={styles.heroIcon}><CalendarClock size={28} /></div>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>TAGESKLARHEIT</div>
          <h1>Was läuft heute?</h1>
          <p>{headerDate}{currentLocation ? ` · ${currentLocation.name}` : ''}</p>
        </div>
        {canSelectLocation && locations.length > 0 && (
          <div className={styles.locationPicker}>
            <label htmlFor="klarheit-location">Standort</label>
            <select
              id="klarheit-location"
              value={locationId}
              disabled={isPending}
              onChange={(e) => changeLocation(e.target.value)}
            >
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}{l.stadt ? ` · ${l.stadt}` : ''}</option>)}
            </select>
          </div>
        )}
      </header>

      <section className={styles.section} aria-labelledby="dienst-heute">
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.sectionEyebrow}>PERSONAL</div>
            <h2 id="dienst-heute" className={styles.sectionTitle}>Heute im Dienst</h2>
          </div>
          <Users className={styles.sectionIcon} size={22} />
        </div>
        {shifts.length === 0 ? (
          <div className={styles.empty}>Heute keine Schichten geplant.</div>
        ) : (
          <div className={styles.stack}>
            {sortedDepartmentIds.map((deptId) => {
              const dept = departmentById.get(deptId);
              const deptShifts = shiftsByDepartment.grouped.get(deptId) ?? [];
              if (!dept || deptShifts.length === 0) return null;
              return (
                <article key={deptId} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.deptName}>{dept.name}</span>
                    <span className={styles.countBadge}>{deptShifts.length}</span>
                  </div>
                  <ul className={styles.rowList}>
                    {deptShifts.map((shift) => {
                      const timing = shiftTiming(shift, nowMs);
                      const name = personName(shift.employee) ?? 'Unbesetzt';
                      const role = Array.isArray(shift.employee) ? shift.employee[0]?.rolle : shift.employee?.rolle;
                      const position = shift.position ?? (Array.isArray(shift.employee) ? shift.employee[0]?.position_title : shift.employee?.position_title);
                      return (
                        <li key={shift.id} className={`${styles.row} ${timing === 'active' ? styles.rowActive : ''}`}>
                          <div className={styles.rowMain}>
                            <span className={styles.rowName}>{name}</span>
                            <span className={styles.rowMeta}>{roleLabel(role)}{position ? ` · ${position}` : ''}</span>
                          </div>
                          <div className={styles.rowTime}>
                            <span>{TIME.format(new Date(shift.start_zeit))}–{TIME.format(new Date(shift.end_zeit))}</span>
                            <span className={styles.rowDuration}>{hoursLabel(shiftDurationMinutes(shift))}</span>
                          </div>
                          {timing === 'active' && <span className={styles.activePill}>Jetzt</span>}
                        </li>
                      );
                    })}
                  </ul>
                </article>
              );
            })}
            {shiftsByDepartment.unassigned.length > 0 && (
              <article className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.deptName}>Ohne Bereich</span>
                  <span className={styles.countBadge}>{shiftsByDepartment.unassigned.length}</span>
                </div>
                <ul className={styles.rowList}>
                  {shiftsByDepartment.unassigned.map((shift) => {
                    const timing = shiftTiming(shift, nowMs);
                    const name = personName(shift.employee) ?? 'Unbesetzt';
                    const role = Array.isArray(shift.employee) ? shift.employee[0]?.rolle : shift.employee?.rolle;
                    const position = shift.position ?? (Array.isArray(shift.employee) ? shift.employee[0]?.position_title : shift.employee?.position_title);
                    return (
                      <li key={shift.id} className={`${styles.row} ${timing === 'active' ? styles.rowActive : ''}`}>
                        <div className={styles.rowMain}>
                          <span className={styles.rowName}>{name}</span>
                          <span className={styles.rowMeta}>{roleLabel(role)}{position ? ` · ${position}` : ''}</span>
                        </div>
                        <div className={styles.rowTime}>
                          <span>{TIME.format(new Date(shift.start_zeit))}–{TIME.format(new Date(shift.end_zeit))}</span>
                          <span className={styles.rowDuration}>{hoursLabel(shiftDurationMinutes(shift))}</span>
                        </div>
                        {timing === 'active' && <span className={styles.activePill}>Jetzt</span>}
                      </li>
                    );
                  })}
                </ul>
              </article>
            )}
          </div>
        )}
      </section>

      <section className={styles.section} aria-labelledby="aufgaben-heute">
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.sectionEyebrow}>OPERATIVE AUFTRÄGE</div>
            <h2 id="aufgaben-heute" className={styles.sectionTitle}>Aufgaben heute</h2>
          </div>
          {overdueTasks.length > 0 && <span className={styles.alertBadge}>{overdueTasks.length} überfällig</span>}
        </div>
        {openTasks.length === 0 ? (
          <div className={styles.empty}>Heute keine offenen Aufgaben.</div>
        ) : (
          <div className={styles.stack}>
            {departments
              .filter((d) => (taskCountsByDepartment.get(d.id)?.total ?? 0) > 0)
              .sort((a, b) => b.prioritaet - a.prioritaet || a.name.localeCompare(b.name))
              .map((dept) => {
                const counts = taskCountsByDepartment.get(dept.id) ?? { total: 0, overdue: 0 };
                return (
                  <article key={dept.id} className={`${styles.card} ${counts.overdue > 0 ? styles.cardAlert : ''}`}>
                    <div className={styles.cardHeader}>
                      <span className={styles.deptName}>{dept.name}</span>
                      <span className={styles.countBadge}>{counts.total}{counts.overdue > 0 ? <span className={styles.overdueMark}> / {counts.overdue} überfällig</span> : null}</span>
                    </div>
                  </article>
                );
              })}
            {(taskCountsByDepartment.get('unassigned')?.total ?? 0) > 0 && (
              <article className={`${styles.card} ${(taskCountsByDepartment.get('unassigned')?.overdue ?? 0) > 0 ? styles.cardAlert : ''}`}>
                <div className={styles.cardHeader}>
                  <span className={styles.deptName}>Ohne Bereich</span>
                  <span className={styles.countBadge}>{taskCountsByDepartment.get('unassigned')?.total ?? 0}</span>
                </div>
              </article>
            )}
            {overdueTasks.length > 0 && (
              <div className={styles.subSection}>
                <h3 className={styles.subTitle}><AlertTriangle size={16} /> Überfällig</h3>
                <ul className={styles.rowList}>
                  {overdueTasks.map((task) => {
                    const dept = task.department_id ? departmentById.get(task.department_id) : undefined;
                    const assignee = task.assignee
                      ? (Array.isArray(task.assignee) ? `${task.assignee[0].vorname} ${task.assignee[0].nachname}` : `${task.assignee.vorname} ${task.assignee.nachname}`)
                      : (task.assigned_to ? 'Zugewiesen' : 'Nicht zugewiesen');
                    return (
                      <li key={task.id} className={`${styles.row} ${styles.rowAlert}`}>
                        <div className={styles.rowMain}>
                          <span className={styles.rowName}>{task.title}</span>
                          <span className={styles.rowMeta}>{dept?.name ?? 'Ohne Bereich'} · {TASK_LABELS[task.status] ?? task.status} · {assignee}</span>
                        </div>
                        <div className={styles.rowTime}>
                          <span>{task.due_at ? TIME.format(new Date(task.due_at)) : '—'}</span>
                          {task.escalation_level > 0 && <span className={styles.escalation}>Esk. {task.escalation_level}</span>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <section className={styles.section} aria-labelledby="abdeckungsluecken">
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.sectionEyebrow}>VERANTWORTUNG</div>
            <h2 id="abdeckungsluecken" className={styles.sectionTitle}>Abdeckungslücken</h2>
          </div>
          {coverage.length === 0 ? <CheckCircle2 className={styles.okIcon} size={22} /> : <AlertTriangle className={styles.sectionIcon} size={22} />}
        </div>
        {coverage.length === 0 ? (
          <div className={styles.empty}>Alle Bereiche sind abgedeckt.</div>
        ) : (
          <div className={styles.stack}>
            {coverage
              .sort((a, b) => b.prioritaet - a.prioritaet || a.name.localeCompare(b.name))
              .map((item) => {
                const primary = item.hauptverantwortlicher_id ? employeeById.get(item.hauptverantwortlicher_id) : undefined;
                const deputy = item.stellvertretung_id ? employeeById.get(item.stellvertretung_id) : undefined;
                const current = item.aktuell_zustaendig_id ? employeeById.get(item.aktuell_zustaendig_id) : undefined;
                return (
                  <article key={item.department_id} className={`${styles.card} ${styles.cardAlert}`}>
                    <div className={styles.cardHeader}>
                      <span className={styles.deptName}>{item.name}</span>
                      <span className={styles.gapBadge}>{COVERAGE_LABELS[item.abdeckungsstatus] ?? item.abdeckungsstatus}</span>
                    </div>
                    <div className={styles.coverageRow}>
                      <span className={styles.coverageLabel}>Hauptverantwortung</span>
                      <span className={styles.coverageValue}>{primary ? `${primary.vorname} ${primary.nachname}` : 'Nicht besetzt'}{item.hauptverantwortlicher_abwesend ? ' · abwesend' : ''}</span>
                    </div>
                    <div className={styles.coverageRow}>
                      <span className={styles.coverageLabel}>Stellvertretung</span>
                      <span className={styles.coverageValue}>{deputy ? `${deputy.vorname} ${deputy.nachname}` : 'Nicht besetzt'}</span>
                    </div>
                    {current && current.id !== primary?.id && (
                      <div className={styles.coverageRow}>
                        <span className={styles.coverageLabel}>Aktuell zuständig</span>
                        <span className={styles.coverageValue}>{`${current.vorname} ${current.nachname}`}</span>
                      </div>
                    )}
                  </article>
                );
              })}
          </div>
        )}
      </section>

      <section className={styles.section} aria-labelledby="abwesend-heute">
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.sectionEyebrow}>ABSENZEN</div>
            <h2 id="abwesend-heute" className={styles.sectionTitle}>Abwesend heute</h2>
          </div>
          <Clock className={styles.sectionIcon} size={22} />
        </div>
        {absences.length === 0 ? (
          <div className={styles.empty}>Heute niemand abwesend gemeldet.</div>
        ) : (
          <div className={styles.stack}>
            {absences.map((absence) => {
              const person = personName(absence.employee);
              const role = Array.isArray(absence.employee) ? absence.employee[0]?.rolle : absence.employee?.rolle;
              const position = Array.isArray(absence.employee) ? absence.employee[0]?.position_title : absence.employee?.position_title;
              return (
                <article key={absence.id} className={styles.card}>
                  <div className={styles.row}>
                    <div className={styles.rowMain}>
                      <span className={styles.rowName}>{person ?? 'Unbekannt'}</span>
                      <span className={styles.rowMeta}>{roleLabel(role)}{position ? ` · ${position}` : ''}</span>
                    </div>
                    <div className={styles.rowTime}>
                      <span className={styles.absenceType}>{ABSENCE_LABELS[absence.typ] ?? absence.typ}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
