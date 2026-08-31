'use client';

import { useMemo, useState, useTransition, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  AlertTriangle, ArrowRight, BadgeCheck, BarChart3, CalendarClock, CheckCircle2,
  ChevronRight, CircleAlert, ClipboardCheck, Clock3, GripVertical, Network,
  Pencil, Plus, RefreshCcw, Save, ShieldCheck, Sunrise, UserRound, UsersRound, Workflow, X,
} from 'lucide-react';
import styles from './responsibility.module.css';

type Employee = {
  id: string; vorname: string; nachname: string; rolle: string; status: string;
  department_id: string | null; reports_to_employee_id: string | null; position_title: string | null;
  organization_level: number;
};
type Department = {
  id: string; name: string; aktiv: boolean; prioritaet: number;
  hauptverantwortung_erforderlich: boolean; stellvertretung_erforderlich: boolean;
  pflichten: string[] | null; geltungsregeln: Record<string, unknown> | null;
};
type Assignment = {
  id: string; department_id: string; employee_id: string;
  responsibility_role: 'hauptverantwortung' | 'stellvertretung'; weekday_scope: number[];
  shift_start: string | null; shift_end: string | null; valid_from: string; valid_until: string | null; aktiv: boolean;
};
type Task = {
  id: string; department_id: string | null; template_id: string | null; shift_id: string | null;
  title: string; description: string | null; status: string;
  priority: number; created_by: string; assigned_to: string | null; accountable_employee_id: string;
  controller_employee_id: string | null; due_at: string | null; completed_at?: string | null;
  evidence_requirements: string[] | null; escalation_level: number; review_note: string | null; created_at: string;
  shift: { start_zeit: string; end_zeit: string; position: string | null } | { start_zeit: string; end_zeit: string; position: string | null }[] | null;
  evidence: { id: string; evidence_type: string; verification_status: string }[] | null;
};
type TaskTemplate = {
  id: string; department_id: string; title: string; description: string | null; task_kind: string;
  trigger_type: string; shift_phase: 'start' | 'end'; due_offset_minutes: number;
  assignment_mode: 'shift_employee' | 'fixed_employee' | 'responsibility_primary';
  assigned_employee_id: string | null; accountable_employee_id: string | null;
  controller_employee_id: string | null; evidence_requirements: string[] | null;
  control_required: boolean; priority: number; aktiv: boolean; created_at: string;
};
type Handover = {
  id: string; department_id: string | null; from_employee_id: string; to_employee_id: string;
  reason: string; starts_at: string; ends_at: string | null; note: string; status: string;
  accepted_at: string | null; read_at: string | null; confirmed_at: string | null; created_at: string;
  open_task_ids: string[]; incidents: string | null; inventory_notes: string | null;
  damage_notes: string | null; cleaning_notes: string | null; important_notes: string | null;
};
type Coverage = {
  department_id: string; hauptverantwortlicher_id: string | null; stellvertretung_id: string | null;
  aktuell_zustaendig_id: string | null; hauptverantwortlicher_abwesend: boolean; abdeckungsstatus: string;
};
type Absence = { employee_id: string; datum: string; typ: string };
type DailyBriefing = {
  briefing_date: string; generated_at: string;
  shifts: unknown[];
  task_counts: { open_count: number; overdue_count: number }[];
  coverage_gaps: unknown[]; absences: unknown[]; escalated_tasks: unknown[];
};
type Location = { id: string; name: string; stadt: string | null };
type Tab = 'dashboard' | 'bereiche' | 'organigramm' | 'aufgaben' | 'ablaeufe' | 'uebergaben';

const TASK_OPEN = new Set(['offen', 'angenommen', 'in_arbeit', 'wartet_auf_pruefung', 'blockiert']);
const EVIDENCE_LABELS: Record<string, string> = {
  foto: 'Foto', kommentar: 'Kommentar', dokument: 'Dokument', unterschrift: 'Unterschrift', messwert: 'Messwert',
};
const TASK_LABELS: Record<string, string> = {
  offen: 'Offen', angenommen: 'Angenommen', in_arbeit: 'In Arbeit', wartet_auf_pruefung: 'Prüfung offen',
  erledigt: 'Freigegeben', nicht_bestanden: 'Nicht bestanden', blockiert: 'Blockiert', storniert: 'Storniert',
};
const WEEKDAYS = [
  { value: 1, label: 'Mo' }, { value: 2, label: 'Di' }, { value: 3, label: 'Mi' },
  { value: 4, label: 'Do' }, { value: 5, label: 'Fr' }, { value: 6, label: 'Sa' },
  { value: 7, label: 'So' },
];

export function ResponsibilityClient({
  actorId, locationId, locations, canSelectLocation,
  employees: initialEmployees, departments, assignments, tasks, templates, handovers, coverage, absences, briefing,
}: {
  actorId: string; locationId: string; locations: Location[]; canSelectLocation: boolean;
  employees: Employee[]; departments: Department[]; assignments: Assignment[]; tasks: Task[]; templates: TaskTemplate[];
  handovers: Handover[]; coverage: Coverage[]; absences: Absence[]; briefing: DailyBriefing | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [tab, setTab] = useState<Tab>(isTab(requestedTab) ? requestedTab : 'dashboard');
  const [employees, setEmployees] = useState(initialEmployees);
  const [departmentForm, setDepartmentForm] = useState<DepartmentForm | null>(null);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [templateForm, setTemplateForm] = useState<TaskTemplateForm | null>(null);
  const [handoverFormOpen, setHandoverFormOpen] = useState(false);
  const [positionEdit, setPositionEdit] = useState<Employee | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byEmployee = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const byDepartment = useMemo(() => new Map(departments.map((department) => [department.id, department])), [departments]);
  const coverageByDepartment = useMemo(() => new Map(coverage.map((item) => [item.department_id, item])), [coverage]);
  const activeTasks = tasks.filter((task) => TASK_OPEN.has(task.status));
  const overdueTasks = activeTasks.filter((task) => task.due_at && new Date(task.due_at) < new Date());
  const failedTasks = tasks.filter((task) => task.status === 'nicht_bestanden');
  const missingEvidenceTasks = activeTasks.filter((task) => (task.evidence_requirements ?? []).some((requirement) => !(task.evidence ?? []).some((evidence) => evidence.evidence_type === requirement)));
  const missingCoverage = coverage.filter((item) => item.abdeckungsstatus.includes('fehlt'));
  const completionRate = tasks.length ? Math.round(tasks.filter((task) => task.status === 'erledigt').length / tasks.length * 100) : 100;
  const currentWeek = weekCompletions(tasks, 0);
  const previousWeek = weekCompletions(tasks, 7);
  const briefingOpen = briefing?.task_counts.reduce((sum, item) => sum + Number(item.open_count || 0), 0) ?? 0;
  const briefingOverdue = briefing?.task_counts.reduce((sum, item) => sum + Number(item.overdue_count || 0), 0) ?? 0;

  function mutation(payload: Record<string, unknown>, successMessage: string, local?: (result: any) => void) {
    setError('');
    startTransition(async () => {
      const response = await fetch('/api/operations/responsibility', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, locationId }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setError(result?.error ?? 'Änderung fehlgeschlagen.');
        return;
      }
      local?.(result);
      setNotice(successMessage);
      window.setTimeout(() => setNotice(''), 2600);
      router.refresh();
    });
  }

  function selectTab(nextTab: Tab) {
    setTab(nextTab);
    const params = new URLSearchParams(window.location.search);
    if (nextTab === 'dashboard') params.delete('tab'); else params.set('tab', nextTab);
    window.history.replaceState(null, '', `${window.location.pathname}${params.size ? `?${params}` : ''}`);
  }

  function handleDragEnd(event: DragEndEvent) {
    const employeeId = String(event.active.id).replace('employee:', '');
    const overId = event.over?.id ? String(event.over.id) : '';
    if (!employeeId || !overId) return;
    const parentId = overId === 'org-root' ? null : overId.replace('manager:', '');
    if (employeeId === parentId || byEmployee.get(employeeId)?.reports_to_employee_id === parentId) return;
    mutation(
      { action: 'move_employee', employeeId, reportsToEmployeeId: parentId },
      parentId ? `Mitarbeiter ist jetzt ${employeeName(parentId, byEmployee)} zugeordnet.` : 'Mitarbeiter ist jetzt auf oberster Ebene.',
      () => setEmployees((current) => current.map((employee) => employee.id === employeeId ? { ...employee, reports_to_employee_id: parentId } : employee)),
    );
  }

  return (
    <div className={styles.module}>
      <section className={styles.hero}>
        <div className={styles.heroIcon}><Network size={27} /></div>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>VERANTWORTUNG · ORGANISATION · KONTROLLE</div>
          <h1>Jeder Bereich hat eine klare Verantwortung.</h1>
          <p>Hierarchie, Pflichtbesetzung, Aufgaben, Stellvertretungen und Eskalationen arbeiten auf derselben Mitarbeiterbasis.</p>
        </div>
        {canSelectLocation && locations.length > 1 && (
          <label className={styles.locationPicker}>Standort
            <select value={locationId} onChange={(event) => router.push(`/neo/app/mitarbeiter?location=${event.target.value}`)}>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.stadt ? ` · ${location.stadt}` : ''}</option>)}
            </select>
          </label>
        )}
      </section>

      {(notice || error) && <div className={error ? styles.error : styles.notice}>{error ? <CircleAlert size={17} /> : <CheckCircle2 size={17} />}{error || notice}</div>}

      <nav className={styles.tabs} aria-label="Verantwortungsmodul">
        <TabButton active={tab === 'dashboard'} onClick={() => selectTab('dashboard')} icon={<BarChart3 size={16} />}>Dashboard</TabButton>
        <TabButton active={tab === 'bereiche'} onClick={() => selectTab('bereiche')} icon={<ShieldCheck size={16} />}>Bereiche</TabButton>
        <TabButton active={tab === 'organigramm'} onClick={() => selectTab('organigramm')} icon={<Network size={16} />}>Organigramm</TabButton>
        <TabButton active={tab === 'aufgaben'} onClick={() => selectTab('aufgaben')} icon={<ClipboardCheck size={16} />}>Aufgaben</TabButton>
        <TabButton active={tab === 'ablaeufe'} onClick={() => selectTab('ablaeufe')} icon={<Workflow size={16} />}>Schichtabläufe</TabButton>
        <TabButton active={tab === 'uebergaben'} onClick={() => selectTab('uebergaben')} icon={<ArrowRight size={16} />}>Übergaben</TabButton>
      </nav>

      {tab === 'dashboard' && (
        <div className={styles.stack}>
          <div className={styles.metrics}>
            <Metric label="Pflichtbereiche offen" value={missingCoverage.length} tone={missingCoverage.length ? 'danger' : 'success'} detail={`${departments.filter((d) => d.aktiv).length} aktive Bereiche`} />
            <Metric label="Aufgaben offen" value={activeTasks.length} detail={`${overdueTasks.length} überfällig`} tone={overdueTasks.length ? 'danger' : 'neutral'} />
            <Metric label="Kontrollen offen" value={tasks.filter((task) => task.status === 'wartet_auf_pruefung').length} detail={`${failedTasks.length} nicht bestanden · ${missingEvidenceTasks.length} Nachweise fehlen`} tone={failedTasks.length || missingEvidenceTasks.length ? 'warning' : 'neutral'} />
            <Metric label="Erledigungsquote" value={`${completionRate}%`} detail={`${signedDelta(currentWeek - previousWeek)} zur Vorwoche`} tone={completionRate >= 90 ? 'success' : completionRate >= 70 ? 'warning' : 'danger'} />
          </div>

          <section className={styles.briefingCard}>
            <div className={styles.briefingHeading}>
              <div className={styles.briefingIcon}><Sunrise size={20} /></div>
              <div><strong>Morgenbriefing</strong><small>{briefing ? `Aktualisiert ${formatDateTime(briefing.generated_at)}` : 'Der erste automatische Lauf steht noch aus.'}</small></div>
              <a href="/neo/app/klarheit">Tagesklarheit öffnen <ChevronRight size={15} /></a>
            </div>
            {briefing ? <div className={styles.briefingFacts}>
              <span><b>{briefing.shifts.length}</b> im Dienst</span>
              <span className={briefingOverdue ? styles.briefingDanger : ''}><b>{briefingOpen}</b> offen · {briefingOverdue} überfällig</span>
              <span className={briefing.coverage_gaps.length ? styles.briefingDanger : ''}><b>{briefing.coverage_gaps.length}</b> Abdeckungslücken</span>
              <span><b>{briefing.absences.length}</b> abwesend</span>
              <span className={briefing.escalated_tasks.length ? styles.briefingDanger : ''}><b>{briefing.escalated_tasks.length}</b> eskaliert</span>
            </div> : <Empty text="Noch kein Briefing für heute materialisiert. Der geschützte Automationslauf holt das selbstständig nach." />}
          </section>

          {missingCoverage.length > 0 && (
            <section className={styles.alertPanel}>
              <div className={styles.panelTitle}><AlertTriangle size={19} /> Sofort zu klären</div>
              <div className={styles.alertGrid}>
                {missingCoverage.map((item) => (
                  <button key={item.department_id} onClick={() => selectTab('bereiche')} className={styles.alertItem}>
                    <span><strong>{byDepartment.get(item.department_id)?.name ?? 'Bereich'}</strong><small>{coverageLabel(item.abdeckungsstatus)}</small></span><ChevronRight size={17} />
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className={styles.twoColumns}>
            <Panel title="Heute und überfällig" icon={<CalendarClock size={18} />}>
              <TaskList tasks={activeTasks.slice(0, 8)} employees={byEmployee} departments={byDepartment} compact onAction={(task, status) => mutation({ action: 'update_task', taskId: task.id, status }, 'Aufgabenstatus aktualisiert.')} />
            </Panel>
            <Panel title="Aktive Vertretungen & Abwesenheit" icon={<UsersRound size={18} />}>
              {coverage.filter((item) => item.hauptverantwortlicher_abwesend).length === 0 && absences.length === 0
                ? <Empty text="Heute liegen keine Abwesenheiten mit Vertretungsbedarf vor." />
                : <div className={styles.list}>
                  {coverage.filter((item) => item.hauptverantwortlicher_abwesend).map((item) => <div className={styles.listRow} key={item.department_id}><span><strong>{byDepartment.get(item.department_id)?.name}</strong><small>{employeeName(item.hauptverantwortlicher_id, byEmployee)} → {employeeName(item.aktuell_zustaendig_id, byEmployee)}</small></span><Status tone={item.aktuell_zustaendig_id ? 'success' : 'danger'}>{item.aktuell_zustaendig_id ? 'Vertretung aktiv' : 'Unbesetzt'}</Status></div>)}
                  {absences.filter((absence) => !coverage.some((item) => item.hauptverantwortlicher_id === absence.employee_id)).map((absence) => <div className={styles.listRow} key={`${absence.employee_id}:${absence.datum}`}><span><strong>{employeeName(absence.employee_id, byEmployee)}</strong><small>{absence.typ}</small></span><Status tone="warning">Abwesend</Status></div>)}
                </div>}
            </Panel>
          </div>
        </div>
      )}

      {tab === 'bereiche' && (
        <div className={styles.stack}>
          <div className={styles.toolbar}>
            <div><h2>Betriebliche Bereiche</h2><p>Pflichtbesetzungen werden ohne Verzögerung als Lücke markiert.</p></div>
            <button className={styles.primaryButton} onClick={() => setDepartmentForm(emptyDepartment())}><Plus size={16} /> Bereich anlegen</button>
          </div>
          {departmentForm && <DepartmentEditor form={departmentForm} setForm={setDepartmentForm} pending={pending} onSave={(form) => mutation({ action: 'save_department', id: form.id || null, name: form.name, aktiv: form.aktiv, priority: form.priority, primaryRequired: form.primaryRequired, deputyRequired: form.deputyRequired, duties: form.dutiesText.split('\n').map((duty) => duty.trim()).filter(Boolean) }, 'Bereich gespeichert.', () => setDepartmentForm(null))} />}
          <div className={styles.departmentGrid}>
            {departments.map((department) => {
              const item = coverageByDepartment.get(department.id);
              const primary = assignments.find((assignment) => assignment.department_id === department.id && assignment.responsibility_role === 'hauptverantwortung');
              const deputy = assignments.find((assignment) => assignment.department_id === department.id && assignment.responsibility_role === 'stellvertretung');
              const hasGap = Boolean(item?.abdeckungsstatus.includes('fehlt'));
              return <article className={`${styles.departmentCard} ${hasGap ? styles.cardDanger : ''}`} key={department.id}>
                <div className={styles.departmentTop}>
                  <div><span className={styles.priority}>Priorität {department.prioritaet}</span><h3>{department.name}</h3></div>
                  <button className={styles.iconButton} aria-label="Bereich bearbeiten" onClick={() => setDepartmentForm(fromDepartment(department))}><Save size={15} /></button>
                </div>
                <div className={styles.coverageState}><Status tone={hasGap ? 'danger' : item?.abdeckungsstatus === 'aktive_vertretung' ? 'warning' : 'success'}>{coverageLabel(item?.abdeckungsstatus ?? 'abgedeckt')}</Status></div>
                <AssignmentEditor key={`${department.id}:primary:${primary?.id ?? 'empty'}`} label="Hauptverantwortung" required={department.hauptverantwortung_erforderlich} assignment={primary} employees={employees.filter((employee) => employee.id !== deputy?.employee_id)} pending={pending} onSave={(scope) => mutation({ action: 'assign_responsibility', departmentId: department.id, role: 'hauptverantwortung', ...scope }, 'Hauptverantwortung aktualisiert.')} />
                <AssignmentEditor key={`${department.id}:deputy:${deputy?.id ?? 'empty'}`} label="Stellvertretung" required={department.stellvertretung_erforderlich} assignment={deputy} employees={employees.filter((employee) => employee.id !== primary?.employee_id)} pending={pending} onSave={(scope) => mutation({ action: 'assign_responsibility', departmentId: department.id, role: 'stellvertretung', ...scope }, 'Stellvertretung aktualisiert.')} />
                <div className={styles.duties}><strong>Aufgaben & Pflichten</strong>{department.pflichten?.length ? <ul>{department.pflichten.map((duty) => <li key={duty}>{duty}</li>)}</ul> : <small>Noch keine Pflichten hinterlegt.</small>}</div>
              </article>;
            })}
          </div>
        </div>
      )}

      {tab === 'organigramm' && (
        <div className={styles.stack}>
          <div className={styles.toolbar}><div><h2>Aktives Organigramm</h2><p>Ziehe eine Person auf ihre neue Führungskraft oder tippe die Karte an. Die Änderung wird sofort protokolliert.</p></div><div className={styles.dragHint}><GripVertical size={15} /> Ziehen oder antippen</div></div>
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <OrgRoot employees={employees} assignments={assignments} tasks={activeTasks} departments={byDepartment} onEditPosition={setPositionEdit} />
          </DndContext>
          {positionEdit && <PositionEditor employee={positionEdit} employees={employees} onClose={() => setPositionEdit(null)} pending={pending} onSave={(title, reportsToEmployeeId) => mutation({ action: 'move_employee', employeeId: positionEdit.id, reportsToEmployeeId, positionTitle: title }, 'Position und Zuordnung aktualisiert.', () => { setEmployees((current) => current.map((item) => item.id === positionEdit.id ? { ...item, position_title: title, reports_to_employee_id: reportsToEmployeeId } : item)); setPositionEdit(null); })} />}
        </div>
      )}

      {tab === 'aufgaben' && (
        <div className={styles.stack}>
          <div className={styles.toolbar}><div><h2>Aufgaben & Kontrollpflichten</h2><p>Ausführung kann delegiert werden; Kontrolle und Rechenschaft bleiben sichtbar.</p></div><button className={styles.primaryButton} onClick={() => setTaskFormOpen(true)}><Plus size={16} /> Aufgabe vergeben</button></div>
          {taskFormOpen && <TaskEditor departments={departments.filter((department) => department.aktiv)} employees={employees} pending={pending} onClose={() => setTaskFormOpen(false)} onSave={(payload) => mutation({ action: 'create_task', ...payload }, 'Aufgabe verbindlich angelegt.', () => setTaskFormOpen(false))} />}
          <div className={styles.taskBoard}>
            <TaskColumn title="Offen / in Arbeit" count={tasks.filter((task) => ['offen', 'angenommen', 'in_arbeit', 'blockiert'].includes(task.status)).length}><TaskList tasks={tasks.filter((task) => ['offen', 'angenommen', 'in_arbeit', 'blockiert'].includes(task.status))} employees={byEmployee} departments={byDepartment} onAction={(task, status) => mutation({ action: 'update_task', taskId: task.id, status }, 'Aufgabenstatus aktualisiert.')} /></TaskColumn>
            <TaskColumn title="Kontrolle erforderlich" count={tasks.filter((task) => task.status === 'wartet_auf_pruefung').length}><TaskList tasks={tasks.filter((task) => task.status === 'wartet_auf_pruefung')} employees={byEmployee} departments={byDepartment} onAction={(task, status) => mutation({ action: 'update_task', taskId: task.id, status }, status === 'erledigt' ? 'Aufgabe geprüft und freigegeben.' : 'Prüfung als nicht bestanden dokumentiert.')} /></TaskColumn>
            <TaskColumn title="Abgeschlossen" count={tasks.filter((task) => ['erledigt', 'nicht_bestanden'].includes(task.status)).length}><TaskList tasks={tasks.filter((task) => ['erledigt', 'nicht_bestanden'].includes(task.status)).slice(0, 30)} employees={byEmployee} departments={byDepartment} /></TaskColumn>
          </div>
        </div>
      )}

      {tab === 'ablaeufe' && (
        <div className={styles.stack}>
          <div className={styles.toolbar}>
            <div><h2>Schichtabläufe</h2><p>Aus einer Vorlage entsteht pro passender Schicht genau eine Aufgabe – mit Frist, Verantwortung und Kontrolle.</p></div>
            <button className={styles.primaryButton} onClick={() => setTemplateForm(emptyTaskTemplate())}><Plus size={16} /> Ablauf anlegen</button>
          </div>
          {templateForm && <TaskTemplateEditor
            form={templateForm}
            setForm={setTemplateForm}
            departments={departments.filter((department) => department.aktiv)}
            employees={employees}
            pending={pending}
            onSave={(form) => mutation({
              action: 'save_task_template', id: form.id || null, departmentId: form.departmentId,
              title: form.title, description: form.description, taskKind: form.taskKind,
              shiftPhase: form.shiftPhase, dueOffsetMinutes: form.dueOffsetMinutes,
              assignmentMode: form.assignmentMode, assignedEmployeeId: form.assignedEmployeeId || null,
              accountableEmployeeId: form.accountableEmployeeId || null,
              controllerEmployeeId: form.controllerEmployeeId || null, priority: form.priority,
              evidenceRequirements: form.evidenceRequirements, active: form.active,
            }, 'Schichtablauf gespeichert und mit passenden Schichten verbunden.', () => setTemplateForm(null))}
          />}
          <div className={styles.workflowGrid}>
            {templates.length ? templates.map((template) => <TaskTemplateCard
              key={template.id} template={template} departments={byDepartment} employees={byEmployee}
              onEdit={() => setTemplateForm(fromTaskTemplate(template))}
            />) : <Empty text="Noch keine Schichtabläufe hinterlegt. Lege den ersten Ablauf für Öffnung, Übergabe oder Schichtende an." />}
          </div>
        </div>
      )}

      {tab === 'uebergaben' && (
        <div className={styles.stack}>
          <div className={styles.toolbar}><div><h2>Verbindliche Übergaben</h2><p>Offene Punkte wechseln mit Zeitraum und Annahmebestätigung zur Vertretung.</p></div><button className={styles.primaryButton} onClick={() => setHandoverFormOpen(true)}><Plus size={16} /> Übergabe erstellen</button></div>
          {handoverFormOpen && <HandoverEditor employees={employees.filter((employee) => employee.id !== actorId)} departments={departments.filter((department) => department.aktiv)} pending={pending} onClose={() => setHandoverFormOpen(false)} onSave={(payload) => mutation({ action: 'create_handover', ...payload }, 'Übergabe erstellt und an die Vertretung gesendet.', () => setHandoverFormOpen(false))} />}
          <div className={styles.handoverGrid}>{handovers.length ? handovers.map((handover) => <article className={styles.handoverCard} key={handover.id}><div className={styles.handoverFlow}><Person employee={byEmployee.get(handover.from_employee_id)} /><ArrowRight size={19} /><Person employee={byEmployee.get(handover.to_employee_id)} /></div><div className={styles.handoverMeta}><Status tone={handover.confirmed_at ? 'success' : 'warning'}>{handover.confirmed_at ? 'Bestätigt' : handover.read_at ? 'Gelesen · Bestätigung offen' : 'Ungelesen'}</Status><span>{reasonLabel(handover.reason)}</span><span>{formatDateTime(handover.starts_at)}{handover.ends_at ? ` – ${formatDateTime(handover.ends_at)}` : ''}</span></div>{handover.note && <HandoverDetail label="Notiz">{handover.note}</HandoverDetail>}{handover.open_task_ids.length > 0 && <HandoverDetail label="Offene Aufgaben"><ul>{handover.open_task_ids.map((id) => <li key={id}>{tasks.find((task) => task.id === id)?.title ?? 'Aufgabe aus der Übergabe'}</li>)}</ul></HandoverDetail>}{handover.incidents && <HandoverDetail label="Besondere Vorkommnisse">{handover.incidents}</HandoverDetail>}{handover.inventory_notes && <HandoverDetail label="Bestände">{handover.inventory_notes}</HandoverDetail>}{handover.damage_notes && <HandoverDetail label="Schäden">{handover.damage_notes}</HandoverDetail>}{handover.cleaning_notes && <HandoverDetail label="Reinigungsprobleme">{handover.cleaning_notes}</HandoverDetail>}{handover.important_notes && <HandoverDetail label="Wichtige Hinweise">{handover.important_notes}</HandoverDetail>}{!handover.confirmed_at && handover.to_employee_id === actorId && <button className={styles.secondaryButton} onClick={() => mutation({ action: 'accept_handover', handoverId: handover.id }, 'Übergabe angenommen.')}><BadgeCheck size={15} /> Lesen & bestätigen</button>}</article>) : <Empty text="Keine offenen oder aktiven Übergaben." />}</div>
        </div>
      )}

      {pending && <div className={styles.saving}><RefreshCcw className={styles.spin} size={16} /> Änderung wird revisionssicher gespeichert …</div>}
    </div>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return <button className={active ? styles.tabActive : ''} onClick={onClick}>{icon}{children}</button>;
}

function Metric({ label, value, detail, tone = 'neutral' }: { label: string; value: number | string; detail: string; tone?: string }) {
  return <article className={`${styles.metric} ${styles[`metric_${tone}`] ?? ''}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section className={styles.panel}><div className={styles.panelTitle}>{icon}{title}</div>{children}</section>;
}

function Status({ tone, children }: { tone: 'success' | 'warning' | 'danger' | 'neutral'; children: ReactNode }) {
  return <span className={`${styles.status} ${styles[`status_${tone}`]}`}>{children}</span>;
}

function HandoverDetail({ label, children }: { label: string; children: ReactNode }) {
  return <div><strong>{label}</strong><div>{children}</div></div>;
}

function AssignmentEditor({ label, required, assignment, employees, pending, onSave }: { label: string; required: boolean; assignment?: Assignment; employees: Employee[]; pending: boolean; onSave: (scope: { employeeId: string | null; weekdays: number[]; shiftStart: string | null; shiftEnd: string | null }) => void }) {
  const [employeeId, setEmployeeId] = useState(assignment?.employee_id ?? '');
  const [weekdays, setWeekdays] = useState<number[]>(assignment?.weekday_scope?.length ? assignment.weekday_scope : WEEKDAYS.map((day) => day.value));
  const [shiftStart, setShiftStart] = useState(assignment?.shift_start?.slice(0, 5) ?? '');
  const [shiftEnd, setShiftEnd] = useState(assignment?.shift_end?.slice(0, 5) ?? '');
  const toggleDay = (day: number) => setWeekdays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort());
  return <div className={styles.assignmentEditor}>
    <label className={styles.assignmentLabel}><span>{label}{required && <em>Pflicht</em>}</span><select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="">Nicht besetzt</option>{employees.map((employee) => <option value={employee.id} key={employee.id}>{employee.vorname} {employee.nachname} · {roleLabel(employee.rolle)}</option>)}</select></label>
    <details className={styles.assignmentScope}>
      <summary><CalendarClock size={13} /> Geltung: {weekdays.length === 7 ? 'täglich' : weekdays.map((day) => WEEKDAYS.find((item) => item.value === day)?.label).join(', ')}{shiftStart && shiftEnd ? ` · ${shiftStart}–${shiftEnd}` : ''}</summary>
      <div className={styles.weekdayPicker}>{WEEKDAYS.map((day) => <button type="button" key={day.value} className={weekdays.includes(day.value) ? styles.weekdayActive : ''} onClick={() => toggleDay(day.value)}>{day.label}</button>)}</div>
      <div className={styles.shiftScope}><label>Von<input type="time" value={shiftStart} onChange={(event) => setShiftStart(event.target.value)} /></label><label>Bis<input type="time" value={shiftEnd} onChange={(event) => setShiftEnd(event.target.value)} /></label><small>Leer lassen, wenn die Verantwortung für den ganzen Tag gilt.</small></div>
    </details>
    <button className={styles.assignmentSave} disabled={pending || (Boolean(employeeId) && weekdays.length === 0) || Boolean(shiftStart) !== Boolean(shiftEnd)} onClick={() => onSave({ employeeId: employeeId || null, weekdays: weekdays.length ? weekdays : WEEKDAYS.map((day) => day.value), shiftStart: shiftStart || null, shiftEnd: shiftEnd || null })}><Save size={13} /> Zuordnung speichern</button>
  </div>;
}

type DepartmentForm = { id: string; name: string; aktiv: boolean; priority: number; primaryRequired: boolean; deputyRequired: boolean; dutiesText: string };
function emptyDepartment(): DepartmentForm { return { id: '', name: '', aktiv: true, priority: 50, primaryRequired: true, deputyRequired: true, dutiesText: '' }; }
function fromDepartment(department: Department): DepartmentForm { return { id: department.id, name: department.name, aktiv: department.aktiv, priority: department.prioritaet, primaryRequired: department.hauptverantwortung_erforderlich, deputyRequired: department.stellvertretung_erforderlich, dutiesText: (department.pflichten ?? []).join('\n') }; }

function DepartmentEditor({ form, setForm, onSave, pending }: { form: DepartmentForm; setForm: (form: DepartmentForm | null) => void; onSave: (form: DepartmentForm) => void; pending: boolean }) {
  return <section className={styles.editor}><div className={styles.editorHeader}><div><strong>{form.id ? 'Bereich bearbeiten' : 'Neuer Bereich'}</strong><small>Eine Pflicht pro Zeile; Priorität 100 ist am höchsten.</small></div><button className={styles.iconButton} onClick={() => setForm(null)}><X size={17} /></button></div><div className={styles.formGrid}><label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="z. B. Küche" /></label><label>Priorität<input type="number" min={0} max={100} value={form.priority} onChange={(event) => setForm({ ...form, priority: Number(event.target.value) })} /></label><label className={styles.check}><input type="checkbox" checked={form.primaryRequired} onChange={(event) => setForm({ ...form, primaryRequired: event.target.checked })} /> Hauptverantwortung ist Pflicht</label><label className={styles.check}><input type="checkbox" checked={form.deputyRequired} onChange={(event) => setForm({ ...form, deputyRequired: event.target.checked })} /> Stellvertretung ist Pflicht</label><label className={styles.full}>Aufgaben, Kontrollen und Pflichten<textarea value={form.dutiesText} onChange={(event) => setForm({ ...form, dutiesText: event.target.value })} rows={4} placeholder={'Öffnung kontrollieren\nTemperaturen dokumentieren\nSchichtübergabe prüfen'} /></label></div><button disabled={pending || form.name.trim().length < 2} className={styles.primaryButton} onClick={() => onSave(form)}><Save size={16} /> Speichern</button></section>;
}

function OrgRoot({ employees, assignments, tasks, departments, onEditPosition }: { employees: Employee[]; assignments: Assignment[]; tasks: Task[]; departments: Map<string, Department>; onEditPosition: (employee: Employee) => void }) {
  const naturalRoots = employees.filter((employee) => !employee.reports_to_employee_id || !employees.some((candidate) => candidate.id === employee.reports_to_employee_id));
  const disconnectedRoots = disconnectedOrganizationRoots(employees, naturalRoots);
  const roots = [...naturalRoots, ...disconnectedRoots];
  const disconnectedIds = new Set(disconnectedRoots.map((employee) => employee.id));
  const leadershipRoots = roots.filter((employee) => !disconnectedIds.has(employee.id) && isLeadershipRoot(employee, employees));
  const unassignedRoots = roots.filter((employee) => !leadershipRoots.some((leader) => leader.id === employee.id));
  const openTaskCount = tasks.filter((task) => TASK_OPEN.has(task.status)).length;
  const organizationData = useMemo(() => {
    const children = new Map<string, Employee[]>();
    const responsibilities = new Map<string, Assignment[]>();
    const operationalTasks = new Map<string, Task[]>();
    for (const employee of employees) {
      if (employee.reports_to_employee_id) children.set(employee.reports_to_employee_id, [...(children.get(employee.reports_to_employee_id) ?? []), employee]);
    }
    for (const assignment of assignments) responsibilities.set(assignment.employee_id, [...(responsibilities.get(assignment.employee_id) ?? []), assignment]);
    for (const task of tasks) {
      for (const employeeId of new Set([task.assigned_to, task.accountable_employee_id].filter(Boolean) as string[])) {
        operationalTasks.set(employeeId, [...(operationalTasks.get(employeeId) ?? []), task]);
      }
    }
    return { children, responsibilities, operationalTasks };
  }, [assignments, employees, tasks]);
  const { setNodeRef, isOver } = useDroppable({ id: 'org-root' });
  return <div ref={setNodeRef} className={`${styles.orgCanvas} ${isOver ? styles.dropActive : ''}`}>
    <div className={styles.orgCanvasHeader}>
      <div><span className={styles.orgRootLabel}>Verantwortungslinie</span><strong>{employees.length} Personen · {openTaskCount} offene Punkte</strong><small>Die Verbindungslinien zeigen, wer wem organisatorisch zugeordnet ist.</small></div>
      <div className={styles.orgLegend}><span><i className={styles.legendPrimary} /> Hauptverantwortung</span><span><i className={styles.legendDeputy} /> Stellvertretung</span><span><i className={styles.legendAlert} /> Handlungsbedarf</span></div>
    </div>
    <div className={styles.orgTreeViewport}>
      <div className={styles.orgRoots}>{leadershipRoots.map((employee) => <OrgNode key={employee.id} employee={employee} organizationData={organizationData} departments={departments} onEditPosition={onEditPosition} visited={new Set()} />)}</div>
      {leadershipRoots.length === 0 && <Empty text="Noch keine Geschäfts-, Betriebs- oder Filialleitung als oberste Ebene zugeordnet." />}
    </div>
    {unassignedRoots.length > 0 && <section className={styles.orgUnassigned}><div><strong>{unassignedRoots.length} Linien noch nicht sauber zugeordnet</strong><small>Ziehe diese Personen auf ihre direkte Führungskraft oder korrigiere die Zuordnung per Antippen. Erst danach gehören sie zur gültigen Verantwortungslinie.</small></div><div className={styles.orgUnassignedGrid}>{unassignedRoots.map((employee) => <OrgNode key={employee.id} employee={employee} organizationData={organizationData} departments={departments} onEditPosition={onEditPosition} visited={new Set()} compact />)}</div></section>}
  </div>;
}

function OrgNode({ employee, organizationData, departments, onEditPosition, visited, compact = false }: { employee: Employee; organizationData: { children: Map<string, Employee[]>; responsibilities: Map<string, Assignment[]>; operationalTasks: Map<string, Task[]> }; departments: Map<string, Department>; onEditPosition: (employee: Employee) => void; visited: Set<string>; compact?: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const cyclicReference = visited.has(employee.id);
  const nextVisited = new Set(visited).add(employee.id);
  const children = organizationData.children.get(employee.id) ?? [];
  const responsibilities = organizationData.responsibilities.get(employee.id) ?? [];
  const openTasks = organizationData.operationalTasks.get(employee.id) ?? [];
  const primaryResponsibilities = responsibilities.filter((assignment) => assignment.responsibility_role === 'hauptverantwortung');
  const deputyResponsibilities = responsibilities.filter((assignment) => assignment.responsibility_role === 'stellvertretung');
  const accountableTasks = openTasks.filter((task) => task.accountable_employee_id === employee.id);
  const hasOverdue = openTasks.some((task) => task.due_at && new Date(task.due_at) < new Date());
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({ id: `employee:${employee.id}` });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `manager:${employee.id}` });
  if (cyclicReference) return null;
  return <div className={`${styles.orgBranch} ${compact ? styles.orgBranchCompact : ''}`}><div ref={setDropRef} className={`${styles.orgDrop} ${isOver ? styles.dropActive : ''}`}><article ref={setDragRef} style={{ transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined, opacity: isDragging ? .55 : 1 }} className={`${styles.orgCard} ${hasOverdue ? styles.orgCardAlert : ''}`}>
    <div className={styles.orgCardTop}><span className={`${styles.orgRole} ${styles[`orgRole_${orgTier(employee.rolle)}`]}`}>{employee.position_title || roleLabel(employee.rolle)}</span><div className={styles.orgCardActions}>{children.length > 0 && <button className={`${styles.orgExpand} ${expanded ? styles.orgExpandOpen : ''}`} aria-label={`${employee.vorname} ${employee.nachname}: Team ${expanded ? 'einklappen' : 'ausklappen'}`} aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}><ChevronRight size={15} /></button>}<button className={styles.dragHandle} {...listeners} {...attributes} aria-label={`${employee.vorname} ${employee.nachname} verschieben`}><GripVertical size={17} /></button></div></div>
    <button className={styles.orgMain} onClick={() => onEditPosition(employee)}><Avatar employee={employee} /><span><strong>{employee.vorname} {employee.nachname}</strong><small>{roleLabel(employee.rolle)} · Ebene {employee.organization_level}</small></span></button>
    {(primaryResponsibilities.length > 0 || deputyResponsibilities.length > 0) && <div className={styles.orgResponsibilityList}>{primaryResponsibilities.map((assignment) => <span className={styles.orgPrimary} key={assignment.id}><ShieldCheck size={11} /> {departments.get(assignment.department_id)?.name ?? 'Bereich'}</span>)}{deputyResponsibilities.map((assignment) => <span className={styles.orgDeputy} key={assignment.id}><BadgeCheck size={11} /> {departments.get(assignment.department_id)?.name ?? 'Bereich'}</span>)}</div>}
    <div className={styles.orgSignals}><span><UsersRound size={13} /><b>{children.length}</b> direkt</span><span className={hasOverdue ? styles.orgSignalAlert : ''}><ClipboardCheck size={13} /><b>{openTasks.length}</b> offen</span><span><ShieldCheck size={13} /><b>{accountableTasks.length}</b> verantwortlich</span></div>
    {openTasks.length > 0 && !compact && <div className={styles.orgTaskPreview}><strong>{hasOverdue ? 'Überfällige / offene Punkte' : 'Offene Punkte'}</strong>{openTasks.slice(0, 2).map((task) => <span key={task.id}>{task.title}</span>)}{openTasks.length > 2 && <small>+ {openTasks.length - 2} weitere</small>}</div>}
  </article></div>{children.length > 0 && expanded && <div className={styles.orgChildren}>{children.map((child) => <OrgNode key={child.id} employee={child} organizationData={organizationData} departments={departments} onEditPosition={onEditPosition} visited={nextVisited} compact={compact} />)}</div>}</div>;
}

function PositionEditor({ employee, employees, onClose, onSave, pending }: { employee: Employee; employees: Employee[]; onClose: () => void; onSave: (title: string, reportsToEmployeeId: string | null) => void; pending: boolean }) {
  const [title, setTitle] = useState(employee.position_title ?? roleLabel(employee.rolle));
  const [reportsToEmployeeId, setReportsToEmployeeId] = useState(employee.reports_to_employee_id ?? '');
  const excludedManagers = descendantIds(employee.id, employees);
  return <section className={styles.editor}><div className={styles.editorHeader}><div><strong>Position von {employee.vorname} {employee.nachname}</strong><small>Position und direkte Führung gelten im Organigramm und in der Mitarbeiter-App.</small></div><button className={styles.iconButton} onClick={onClose}><X size={17} /></button></div><div className={styles.formGrid}><label>Position<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="z. B. Filialleitung" /></label><label>Direkte Führung<select value={reportsToEmployeeId} onChange={(event) => setReportsToEmployeeId(event.target.value)}><option value="">Oberste Ebene / noch nicht zugeordnet</option>{employees.filter((candidate) => candidate.id !== employee.id && !excludedManagers.has(candidate.id)).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.vorname} {candidate.nachname} · {candidate.position_title || roleLabel(candidate.rolle)}</option>)}</select></label></div><button className={styles.primaryButton} disabled={pending || title.trim().length < 2} onClick={() => onSave(title.trim(), reportsToEmployeeId || null)}><Save size={15} /> Position & Führung speichern</button></section>;
}

function TaskEditor({ departments, employees, pending, onClose, onSave }: { departments: Department[]; employees: Employee[]; pending: boolean; onClose: () => void; onSave: (payload: Record<string, unknown>) => void }) {
  const [form, setForm] = useState({ title: '', description: '', departmentId: '', assignedTo: '', accountableEmployeeId: '', controllerEmployeeId: '', dueAt: '', priority: 50, evidenceRequirements: [] as string[] });
  const toggleEvidence = (value: string) => setForm((current) => ({ ...current, evidenceRequirements: current.evidenceRequirements.includes(value) ? current.evidenceRequirements.filter((item) => item !== value) : [...current.evidenceRequirements, value] }));
  return <section className={styles.editor}><div className={styles.editorHeader}><div><strong>Neue Aufgabe oder Kontrolle</strong><small>Ausführung, Rechenschaft und Prüfung werden getrennt dokumentiert.</small></div><button className={styles.iconButton} onClick={onClose}><X size={17} /></button></div><div className={styles.formGrid}><label>Titel<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="z. B. Schließkontrolle" /></label><label>Bereich<select value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })}><option value="">Standortweit</option>{departments.map((department) => <option value={department.id} key={department.id}>{department.name}</option>)}</select></label><EmployeeSelect label="Ausführung" value={form.assignedTo} employees={employees} onChange={(value) => setForm({ ...form, assignedTo: value })} /><EmployeeSelect label="Rechenschaft" value={form.accountableEmployeeId} employees={employees} onChange={(value) => setForm({ ...form, accountableEmployeeId: value })} optional /><EmployeeSelect label="Kontrolle / Freigabe" value={form.controllerEmployeeId} employees={employees} onChange={(value) => setForm({ ...form, controllerEmployeeId: value })} optional /><label>Fällig<input type="datetime-local" value={form.dueAt} onChange={(event) => setForm({ ...form, dueAt: event.target.value })} /></label><label>Priorität<input type="number" min={0} max={100} value={form.priority} onChange={(event) => setForm({ ...form, priority: Number(event.target.value) })} /></label><label className={styles.full}>Beschreibung<textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><fieldset className={styles.full}><legend>Erforderliche Nachweise</legend><div className={styles.evidenceChecks}>{Object.entries(EVIDENCE_LABELS).map(([value, label]) => <label className={styles.check} key={value}><input type="checkbox" checked={form.evidenceRequirements.includes(value)} onChange={() => toggleEvidence(value)} /> {label}</label>)}</div></fieldset></div><button className={styles.primaryButton} disabled={pending || form.title.trim().length < 2 || !form.assignedTo} onClick={() => onSave({ ...form, departmentId: form.departmentId || null, accountableEmployeeId: form.accountableEmployeeId || null, controllerEmployeeId: form.controllerEmployeeId || null, dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null })}><Plus size={16} /> Verbindlich vergeben</button></section>;
}

type TaskTemplateForm = {
  id: string; departmentId: string; title: string; description: string; taskKind: string;
  shiftPhase: 'start' | 'end'; dueOffsetMinutes: number;
  assignmentMode: 'shift_employee' | 'fixed_employee' | 'responsibility_primary';
  assignedEmployeeId: string; accountableEmployeeId: string; controllerEmployeeId: string;
  evidenceRequirements: string[]; priority: number; active: boolean;
};
function emptyTaskTemplate(): TaskTemplateForm {
  return { id: '', departmentId: '', title: '', description: '', taskKind: 'kontrolle', shiftPhase: 'start', dueOffsetMinutes: 30, assignmentMode: 'shift_employee', assignedEmployeeId: '', accountableEmployeeId: '', controllerEmployeeId: '', evidenceRequirements: [], priority: 70, active: true };
}
function fromTaskTemplate(template: TaskTemplate): TaskTemplateForm {
  return { id: template.id, departmentId: template.department_id, title: template.title, description: template.description ?? '', taskKind: template.task_kind, shiftPhase: template.shift_phase, dueOffsetMinutes: template.due_offset_minutes, assignmentMode: template.assignment_mode, assignedEmployeeId: template.assigned_employee_id ?? '', accountableEmployeeId: template.accountable_employee_id ?? '', controllerEmployeeId: template.controller_employee_id ?? '', evidenceRequirements: template.evidence_requirements ?? [], priority: template.priority, active: template.aktiv };
}

function TaskTemplateEditor({ form, setForm, departments, employees, pending, onSave }: { form: TaskTemplateForm; setForm: (form: TaskTemplateForm | null) => void; departments: Department[]; employees: Employee[]; pending: boolean; onSave: (form: TaskTemplateForm) => void }) {
  const toggleEvidence = (value: string) => setForm({ ...form, evidenceRequirements: form.evidenceRequirements.includes(value) ? form.evidenceRequirements.filter((item) => item !== value) : [...form.evidenceRequirements, value] });
  const fixedEmployeeMissing = form.assignmentMode === 'fixed_employee' && !form.assignedEmployeeId;
  return <section className={`${styles.editor} ${styles.workflowEditor}`}>
    <div className={styles.editorHeader}><div><strong>{form.id ? 'Schichtablauf bearbeiten' : 'Neuer Schichtablauf'}</strong><small>Der Ablauf wird automatisch erzeugt, sobald eine passende Schicht einer Person zugeteilt ist.</small></div><button className={styles.iconButton} onClick={() => setForm(null)}><X size={17} /></button></div>
    <div className={styles.formGrid}>
      <label>Titel<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="z. B. Barista-Abschluss" /></label>
      <label>Bereich<select value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })}><option value="">Bitte auswählen</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
      <label>Art<select value={form.taskKind} onChange={(event) => setForm({ ...form, taskKind: event.target.value })}><option value="kontrolle">Kontrolle</option><option value="checkliste">Checkliste</option><option value="hygiene">Hygiene</option><option value="temperatur">Temperatur</option><option value="lager">Lager</option><option value="reinigung">Reinigung</option><option value="training">Training</option><option value="qualitaet">Qualität</option><option value="aufgabe">Aufgabe</option></select></label>
      <label>Zeitpunkt<select value={form.shiftPhase} onChange={(event) => setForm({ ...form, shiftPhase: event.target.value as 'start' | 'end' })}><option value="start">Ab Schichtbeginn</option><option value="end">Zum Schichtende</option></select></label>
      <label>Fristversatz in Minuten<input type="number" min={-720} max={1440} value={form.dueOffsetMinutes} onChange={(event) => setForm({ ...form, dueOffsetMinutes: Number(event.target.value) })} /></label>
      <label>Ausführung<select value={form.assignmentMode} onChange={(event) => setForm({ ...form, assignmentMode: event.target.value as TaskTemplateForm['assignmentMode'], assignedEmployeeId: '' })}><option value="shift_employee">Diensthabende Person</option><option value="responsibility_primary">Bereichsverantwortung</option><option value="fixed_employee">Feste Person</option></select></label>
      {form.assignmentMode === 'fixed_employee' && <EmployeeSelect label="Feste Ausführung" value={form.assignedEmployeeId} employees={employees} onChange={(value) => setForm({ ...form, assignedEmployeeId: value })} />}
      <EmployeeSelect label="Bleibt verantwortlich" value={form.accountableEmployeeId} employees={employees} onChange={(value) => setForm({ ...form, accountableEmployeeId: value })} optional />
      <EmployeeSelect label="Kontrolliert und gibt frei" value={form.controllerEmployeeId} employees={employees} onChange={(value) => setForm({ ...form, controllerEmployeeId: value })} optional />
      <label>Priorität<input type="number" min={0} max={100} value={form.priority} onChange={(event) => setForm({ ...form, priority: Number(event.target.value) })} /></label>
      <label className={styles.check}><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Ablauf ist aktiv</label>
      <label className={styles.full}>Klare Arbeitsanweisung<textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Was ist zu tun, wann gilt es als erledigt und was wird bei einer Abweichung gemeldet?" /></label>
      <fieldset className={styles.full}><legend>Nachweis vor Einreichung</legend><div className={styles.evidenceChecks}>{Object.entries(EVIDENCE_LABELS).map(([value, label]) => <label className={styles.check} key={value}><input type="checkbox" checked={form.evidenceRequirements.includes(value)} onChange={() => toggleEvidence(value)} /> {label}</label>)}</div></fieldset>
    </div>
    <button className={styles.primaryButton} disabled={pending || form.title.trim().length < 2 || !form.departmentId || fixedEmployeeMissing} onClick={() => onSave(form)}><Save size={16} /> Ablauf speichern</button>
  </section>;
}

function TaskTemplateCard({ template, departments, employees, onEdit }: { template: TaskTemplate; departments: Map<string, Department>; employees: Map<string, Employee>; onEdit: () => void }) {
  const assignee = template.assignment_mode === 'shift_employee' ? 'Diensthabende Person' : template.assignment_mode === 'responsibility_primary' ? 'Bereichsverantwortung' : employeeName(template.assigned_employee_id, employees);
  const phase = template.shift_phase === 'start' ? 'Schichtbeginn' : 'Schichtende';
  const offset = template.due_offset_minutes === 0 ? 'sofort fällig' : template.due_offset_minutes > 0 ? `+${template.due_offset_minutes} Min.` : `${template.due_offset_minutes} Min.`;
  return <article className={`${styles.workflowCard} ${!template.aktiv ? styles.workflowInactive : ''}`}>
    <div className={styles.workflowTop}><div><span>{departments.get(template.department_id)?.name ?? 'Bereich'}</span><h3>{template.title}</h3></div><div className={styles.workflowActions}><Status tone={template.aktiv ? 'success' : 'neutral'}>{template.aktiv ? 'Aktiv' : 'Pausiert'}</Status><button className={styles.iconButton} aria-label="Schichtablauf bearbeiten" onClick={onEdit}><Pencil size={15} /></button></div></div>
    {template.description && <p>{template.description}</p>}
    <div className={styles.workflowRail} aria-label={`${phase}, ${assignee}, ${offset}, Kontrolle`}>
      <span><Clock3 size={14} /><b>{phase}</b></span><i />
      <span><UserRound size={14} /><b>{assignee}</b></span><i />
      <span><CalendarClock size={14} /><b>{offset}</b></span><i />
      <span><ShieldCheck size={14} /><b>Freigabe</b></span>
    </div>
    <div className={styles.workflowFacts}><span>Verantwortung: <b>{employeeName(template.accountable_employee_id, employees).replace('Nicht zugeordnet', 'automatisch aus Bereich')}</b></span><span>Kontrolle: <b>{employeeName(template.controller_employee_id, employees).replace('Nicht zugeordnet', 'Bereichsverantwortung')}</b></span><span>Nachweis: <b>{template.evidence_requirements?.length ? template.evidence_requirements.map((item) => EVIDENCE_LABELS[item] ?? item).join(', ') : 'keiner'}</b></span></div>
  </article>;
}

function HandoverEditor({ employees, departments, pending, onClose, onSave }: { employees: Employee[]; departments: Department[]; pending: boolean; onClose: () => void; onSave: (payload: Record<string, unknown>) => void }) {
  const now = toLocalInput(new Date());
  const [form, setForm] = useState({ toEmployeeId: '', departmentId: '', reason: 'schichtende', startsAt: now, endsAt: '', note: '' });
  return <section className={styles.editor}><div className={styles.editorHeader}><div><strong>Neue Übergabe</strong><small>Die Vertretung muss die Übergabe aktiv annehmen.</small></div><button className={styles.iconButton} onClick={onClose}><X size={17} /></button></div><div className={styles.formGrid}><EmployeeSelect label="Vertretung" value={form.toEmployeeId} employees={employees} onChange={(value) => setForm({ ...form, toEmployeeId: value })} /><label>Bereich<select value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })}><option value="">Alle eigenen Bereiche</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><label>Grund<select value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })}><option value="schichtende">Schichtende</option><option value="urlaub">Urlaub</option><option value="krankheit">Krankheit</option><option value="sonstiges">Sonstiges</option></select></label><label>Beginn<input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></label><label>Ende (optional)<input type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></label><label className={styles.full}>Offene Punkte und Hinweise<textarea rows={4} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label></div><button className={styles.primaryButton} disabled={pending || !form.toEmployeeId || form.note.trim().length < 2} onClick={() => onSave({ ...form, departmentId: form.departmentId || null, startsAt: new Date(form.startsAt).toISOString(), endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null })}><ArrowRight size={16} /> Übergabe senden</button></section>;
}

function EmployeeSelect({ label, value, employees, onChange, optional }: { label: string; value: string; employees: Employee[]; onChange: (value: string) => void; optional?: boolean }) {
  return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}><option value="">{optional ? 'Automatisch / keine' : 'Bitte auswählen'}</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.vorname} {employee.nachname} · {roleLabel(employee.rolle)}</option>)}</select></label>;
}

function TaskColumn({ title, count, children }: { title: string; count: number; children: ReactNode }) { return <section className={styles.taskColumn}><div className={styles.taskColumnHeader}><strong>{title}</strong><span>{count}</span></div>{children}</section>; }

function TaskList({ tasks, employees, departments, compact, onAction }: { tasks: Task[]; employees: Map<string, Employee>; departments: Map<string, Department>; compact?: boolean; onAction?: (task: Task, status: string) => void }) {
  if (!tasks.length) return <Empty text="Keine Einträge in diesem Status." />;
  return <div className={styles.taskList}>{tasks.map((task) => { const overdueNow = Boolean(task.due_at && TASK_OPEN.has(task.status) && new Date(task.due_at) < new Date()); const missing = (task.evidence_requirements ?? []).filter((requirement) => !(task.evidence ?? []).some((evidence) => evidence.evidence_type === requirement)); const shift = relationOne(task.shift); return <article className={`${styles.taskCard} ${overdueNow ? styles.taskOverdue : ''}`} key={task.id}><div className={styles.taskTop}><Status tone={task.status === 'erledigt' ? 'success' : task.status === 'nicht_bestanden' || overdueNow ? 'danger' : task.status === 'wartet_auf_pruefung' ? 'warning' : 'neutral'}>{TASK_LABELS[task.status] ?? task.status}</Status>{task.escalation_level > 0 && <span className={styles.escalation}>Eskalation {task.escalation_level}</span>}</div><h4>{task.title}</h4>{!compact && task.description && <p>{task.description}</p>}<div className={styles.taskDetails}><span>{departments.get(task.department_id ?? '')?.name ?? 'Standortweit'}</span>{shift && <span className={styles.shiftTask}><Clock3 size={11} /> Schicht {formatShift(shift)}</span>}<span>Ausführung: {employeeName(task.assigned_to, employees)}</span><span>Verantwortung: {employeeName(task.accountable_employee_id, employees)}</span><span>Kontrolle: {employeeName(task.controller_employee_id, employees)}</span>{task.due_at && <span className={overdueNow ? styles.dueDanger : ''}>Fällig: {formatDateTime(task.due_at)}</span>}{task.evidence_requirements?.length ? <span className={missing.length ? styles.dueDanger : ''}>Nachweise: {missing.length ? `${missing.map((item) => EVIDENCE_LABELS[item] ?? item).join(', ')} fehlt` : 'vollständig'}</span> : null}</div>{onAction && <div className={styles.taskActions}>{task.status === 'offen' && <button onClick={() => onAction(task, 'angenommen')}>Annehmen</button>}{task.status === 'angenommen' && <button onClick={() => onAction(task, 'in_arbeit')}>Starten</button>}{['offen', 'angenommen', 'in_arbeit', 'blockiert'].includes(task.status) && <button onClick={() => onAction(task, 'wartet_auf_pruefung')}>Zur Prüfung</button>}{task.status === 'wartet_auf_pruefung' && <><button className={styles.passButton} onClick={() => onAction(task, 'erledigt')}>Freigeben</button><button className={styles.failButton} onClick={() => onAction(task, 'nicht_bestanden')}>Ablehnen</button></>}</div>}</article>; })}</div>;
}

function Person({ employee }: { employee?: Employee }) { return <div className={styles.person}><Avatar employee={employee} /><span><strong>{employee ? `${employee.vorname} ${employee.nachname}` : 'Unbekannt'}</strong><small>{employee?.position_title || roleLabel(employee?.rolle ?? '')}</small></span></div>; }
function Avatar({ employee }: { employee?: Employee }) { return <span className={styles.avatar}>{employee ? `${employee.vorname[0] ?? ''}${employee.nachname[0] ?? ''}` : <UserRound size={16} />}</span>; }
function Empty({ text }: { text: string }) { return <div className={styles.empty}>{text}</div>; }

function employeeName(id: string | null | undefined, map: Map<string, Employee>) { const employee = id ? map.get(id) : null; return employee ? `${employee.vorname} ${employee.nachname}` : 'Nicht zugeordnet'; }
function roleLabel(role: string) { return ({ admin: 'Geschäftsführung', backoffice: 'Betriebsleitung', manager: 'Filialleitung', teamleiter: 'Schichtleitung', mitarbeiter: 'Mitarbeiter', server: 'Service', bartender: 'Theke', cook: 'Küche', dishwasher: 'Spülküche' } as Record<string, string>)[role] ?? (role || 'Mitarbeiter'); }
function orgTier(role: string) { return ({ admin: 'executive', backoffice: 'operations', manager: 'location', teamleiter: 'lead' } as Record<string, string>)[role] ?? 'team'; }
function isLeadershipRoot(employee: Employee, employees: Employee[]) { return ['admin', 'backoffice', 'manager'].includes(employee.rolle) || employees.some((candidate) => candidate.reports_to_employee_id === employee.id) || /geschäftsführung|betriebsleitung|filialleitung|standortleitung/i.test(employee.position_title ?? ''); }
function disconnectedOrganizationRoots(employees: Employee[], naturalRoots: Employee[]) { const children = new Map<string, Employee[]>(); for (const employee of employees) { if (employee.reports_to_employee_id) children.set(employee.reports_to_employee_id, [...(children.get(employee.reports_to_employee_id) ?? []), employee]); } const visited = new Set<string>(); const visit = (root: Employee) => { const pending = [root]; while (pending.length) { const current = pending.pop()!; if (visited.has(current.id)) continue; visited.add(current.id); pending.push(...(children.get(current.id) ?? [])); } }; naturalRoots.forEach(visit); const disconnected: Employee[] = []; for (const employee of employees) { if (!visited.has(employee.id)) { disconnected.push(employee); visit(employee); } } return disconnected; }
function descendantIds(employeeId: string, employees: Employee[]) { const result = new Set<string>(); let changed = true; while (changed) { changed = false; for (const employee of employees) { if (!result.has(employee.id) && (employee.reports_to_employee_id === employeeId || (employee.reports_to_employee_id && result.has(employee.reports_to_employee_id)))) { result.add(employee.id); changed = true; } } } return result; }
function coverageLabel(status: string) { return ({ hauptverantwortung_fehlt: 'Hauptverantwortung fehlt', stellvertretung_fehlt: 'Stellvertretung fehlt', vertretung_waehrend_abwesenheit_fehlt: 'Vertretung bei Abwesenheit fehlt', aktive_vertretung: 'Vertretung ist aktiv', abgedeckt: 'Vollständig abgedeckt' } as Record<string, string>)[status] ?? status; }
function reasonLabel(reason: string) { return ({ schichtende: 'Schichtende', urlaub: 'Urlaub', krankheit: 'Krankheit', sonstiges: 'Sonstiger Grund' } as Record<string, string>)[reason] ?? reason; }
function formatDateTime(value: string) { return new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(new Date(value)); }
function relationOne<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
function formatShift(shift: { start_zeit: string; end_zeit: string; position: string | null }) { const start = new Date(shift.start_zeit); const end = new Date(shift.end_zeit); const timeZone = 'Europe/Berlin'; return `${start.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone })} · ${start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone })}–${end.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone })}${shift.position ? ` · ${shift.position}` : ''}`; }
function toLocalInput(value: Date) { const shifted = new Date(value.getTime() - value.getTimezoneOffset() * 60_000); return shifted.toISOString().slice(0, 16); }
function signedDelta(value: number) { return `${value > 0 ? '+' : ''}${value}`; }
function weekCompletions(tasks: Task[], offsetDays: number) { const end = Date.now() - offsetDays * 86_400_000; const start = end - 7 * 86_400_000; return tasks.filter((task) => task.status === 'erledigt' && task.completed_at && new Date(task.completed_at).getTime() >= start && new Date(task.completed_at).getTime() < end).length; }
function isTab(value: string | null): value is Tab { return value === 'dashboard' || value === 'bereiche' || value === 'organigramm' || value === 'aufgaben' || value === 'ablaeufe' || value === 'uebergaben'; }
