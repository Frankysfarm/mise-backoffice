'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, ArrowRight, BadgeCheck, CheckCircle2, Clock3, ShieldCheck, UsersRound } from 'lucide-react';

type Responsibility = {
  id: string; responsibility_role: string; weekday_scope: number[]; shift_start: string | null; shift_end: string | null;
  department: { id: string; name: string } | { id: string; name: string }[] | null;
};
type Task = {
  id: string; shift_id: string | null; title: string; description: string | null; status: string; priority: number; due_at: string | null;
  completed_at: string | null; evidence_requirements: string[] | null; escalation_level: number;
  assigned_to: string | null; accountable_employee_id: string; controller_employee_id: string | null;
  department: { name: string } | { name: string }[] | null;
  shift: { start_zeit: string; end_zeit: string; position: string | null } | { start_zeit: string; end_zeit: string; position: string | null }[] | null;
  evidence: { id: string; evidence_type: string; verification_status: string; submitted_at: string }[] | null;
};
type Handover = {
  id: string; reason: string; starts_at: string; ends_at: string | null; note: string; status: string;
  from_employee_id: string; to_employee_id: string;
  department: { name: string } | { name: string }[] | null;
  from_employee: { vorname: string; nachname: string } | { vorname: string; nachname: string }[] | null;
  to_employee: { vorname: string; nachname: string } | { vorname: string; nachname: string }[] | null;
};
type TeamPerson = {
  id: string;
  vorname: string;
  nachname: string;
  rolle: string;
  position_title: string | null;
  reports_to_employee_id: string | null;
};
type OrganizationContext = { self: TeamPerson; leaders: TeamPerson[]; directReports: TeamPerson[] };
type ResponsibilityCoverage = {
  id: string;
  department_id: string;
  employee_id: string;
  responsibility_role: string;
  employee_name: string;
};

const openStates = new Set(['offen', 'angenommen', 'in_arbeit', 'wartet_auf_pruefung', 'blockiert']);
const statusLabel: Record<string, string> = { offen: 'Offen', angenommen: 'Angenommen', in_arbeit: 'In Arbeit', wartet_auf_pruefung: 'Prüfung offen', erledigt: 'Freigegeben', nicht_bestanden: 'Nicht bestanden', blockiert: 'Blockiert' };

export function MyOperations({
  actorId, locationId, responsibilities, tasks: initialTasks, handovers: initialHandovers,
  organization, responsibilityCoverage,
}: {
  actorId: string;
  locationId: string;
  responsibilities: Responsibility[];
  tasks: Task[];
  handovers: Handover[];
  organization: OrganizationContext;
  responsibilityCoverage: ResponsibilityCoverage[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [handovers, setHandovers] = useState(initialHandovers);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const active = tasks.filter((task) => openStates.has(task.status));
  const overdue = active.filter((task) => task.due_at && new Date(task.due_at) < new Date());
  const controls = tasks.filter((task) => task.status === 'wartet_auf_pruefung' && (task.controller_employee_id === actorId || task.accountable_employee_id === actorId));
  const failed = tasks.filter((task) => task.status === 'nicht_bestanden');
  const escalations = active.filter((task) => task.escalation_level > 0);
  const completed = tasks.filter((task) => task.status === 'erledigt').length;
  const quality = tasks.length ? Math.round(completed / tasks.length * 100) : 100;

  function updateTask(task: Task, status: string) {
    mutate({ action: 'update_task', taskId: task.id, status }, (result) => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, ...result.task } : item)));
  }
  function acceptHandover(handover: Handover) {
    mutate({ action: 'accept_handover', handoverId: handover.id }, () => setHandovers((current) => current.map((item) => item.id === handover.id ? { ...item, status: 'angenommen' } : item)));
  }
  function addEvidence(taskId: string, evidence: Task['evidence'] extends (infer T)[] | null ? T : never) {
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, evidence: [...(task.evidence ?? []), evidence] } : task));
  }
  function mutate(payload: Record<string, unknown>, onSuccess: (result: any) => void) {
    setError('');
    startTransition(async () => {
      const response = await fetch('/api/operations/responsibility', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, locationId }) });
      const result = await response.json().catch(() => null);
      if (!response.ok) { setError(result?.error ?? 'Änderung fehlgeschlagen.'); return; }
      onSuccess(result);
    });
  }

  return <section id="verantwortung" className="mt-9 scroll-mt-20 px-4 sm:px-8" aria-labelledby="operations-title">
    <div className="mb-4 flex items-end justify-between gap-3"><div><div className="text-xs font-bold uppercase tracking-[.14em] text-indigo-700">Verantwortung</div><h2 id="operations-title" className="mt-1 text-xl font-bold tracking-tight">Mein Bereich heute</h2></div><ShieldCheck className="text-slate-400" size={22} /></div>
    {error && <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</div>}
    <TeamPath organization={organization} />
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <MiniMetric label="Bereiche" value={responsibilities.length} /><MiniMetric label="Offen" value={active.length} /><MiniMetric label="Überfällig" value={overdue.length} danger={overdue.length > 0} /><MiniMetric label="Kontrolle" value={controls.length} /><MiniMetric label="Qualität" value={`${quality}%`} />
    </div>

    {responsibilities.length > 0 && <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-indigo-950"><ShieldCheck size={16} /> Meine Verantwortungsbereiche</div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">{responsibilities.map((item) => {
        const departmentId = relationId(item.department);
        const counterpartRole = item.responsibility_role === 'hauptverantwortung' ? 'stellvertretung' : 'hauptverantwortung';
        const counterpart = responsibilityCoverage.find((entry) => entry.department_id === departmentId && entry.responsibility_role === counterpartRole);
        return <article key={item.id} className="rounded-xl border border-indigo-100 bg-white p-3 shadow-sm">
          <div className="text-sm font-bold text-indigo-950">{relationName(item.department)}</div>
          <div className="mt-1 text-xs font-semibold text-indigo-700">{item.responsibility_role === 'hauptverantwortung' ? 'Hauptverantwortung' : 'Stellvertretung'}</div>
          <div className="mt-2 text-xs text-slate-500">{item.responsibility_role === 'hauptverantwortung' ? 'Vertretung' : 'Hauptverantwortung'}: <strong className="text-slate-700">{counterpart?.employee_name ?? 'noch nicht besetzt'}</strong></div>
        </article>;
      })}</div>
    </div>}

    {(overdue.length > 0 || failed.length > 0 || escalations.length > 0) && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4"><div className="flex items-center gap-2 text-sm font-bold text-red-900"><AlertTriangle size={17} /> Aufmerksamkeit erforderlich</div><p className="mt-1 text-xs text-red-800">{overdue.length} überfällig · {failed.length} nicht bestanden · {escalations.length} eskaliert</p></div>}

    <div id="meine-aufgaben" className="mt-4 scroll-mt-20 space-y-3">
      {active.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-7 text-center text-sm text-slate-500"><CheckCircle2 className="mx-auto mb-2 text-emerald-600" size={24} />Aktuell sind keine betrieblichen Aufgaben offen.</div>}
      {active.map((task) => { const isOverdue = Boolean(task.due_at && new Date(task.due_at) < new Date()); const mayReview = task.status === 'wartet_auf_pruefung' && (task.accountable_employee_id === actorId || task.controller_employee_id === actorId); const shift = relationOne(task.shift); return <article key={task.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${isOverdue ? 'border-red-200' : 'border-slate-200'}`}><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="text-xs font-bold uppercase tracking-wide text-indigo-700">{relationName(task.department)}</div><h3 className="mt-1 font-bold">{task.title}</h3></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${isOverdue ? 'bg-red-100 text-red-800' : task.status === 'wartet_auf_pruefung' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>{statusLabel[task.status] ?? task.status}</span></div>{task.description && <p className="mt-2 text-sm text-slate-600">{task.description}</p>}{shift && <div className="mt-3 flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-900"><Clock3 size={14} /> Gehört zu deiner Schicht: {formatShift(shift)}</div>}<div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">{task.due_at && <span className={isOverdue ? 'font-bold text-red-700' : ''}>Fällig {new Date(task.due_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</span>}{task.evidence_requirements?.length ? <span>Nachweis: {task.evidence_requirements.join(', ')}</span> : null}{task.evidence?.length ? <span className="font-semibold text-emerald-700">{task.evidence.length} Nachweis(e) erfasst</span> : null}{task.escalation_level > 0 && <span className="font-bold text-red-700">Eskalation {task.escalation_level}</span>}</div>{task.assigned_to === actorId && ['angenommen', 'in_arbeit', 'blockiert'].includes(task.status) && <EvidenceUploader task={task} onUploaded={(evidence) => addEvidence(task.id, evidence)} />}<div className="mt-3 flex flex-wrap gap-2">{task.assigned_to === actorId && task.status === 'offen' && <ActionButton disabled={pending} onClick={() => updateTask(task, 'angenommen')}>Annehmen</ActionButton>}{task.assigned_to === actorId && task.status === 'angenommen' && <ActionButton disabled={pending} onClick={() => updateTask(task, 'in_arbeit')}>Starten</ActionButton>}{task.assigned_to === actorId && ['angenommen', 'in_arbeit', 'blockiert'].includes(task.status) && <ActionButton disabled={pending} onClick={() => updateTask(task, 'wartet_auf_pruefung')}>Zur Prüfung einreichen <ArrowRight size={13} /></ActionButton>}{mayReview && <><ActionButton disabled={pending} onClick={() => updateTask(task, 'erledigt')} success>Prüfen & freigeben</ActionButton><ActionButton disabled={pending} onClick={() => updateTask(task, 'nicht_bestanden')} danger>Nicht bestanden</ActionButton></>}</div></article>; })}
    </div>

    {handovers.length > 0 && <div className="mt-7"><div className="mb-3 flex items-center gap-2 text-sm font-bold"><BadgeCheck size={17} /> Meine Übergaben</div><div className="space-y-3">{handovers.map((handover) => <article className="rounded-2xl border border-slate-200 bg-white p-4" key={handover.id}><div className="flex flex-wrap items-start justify-between gap-2"><div><strong className="text-sm">{personName(handover.from_employee)} → {personName(handover.to_employee)}</strong><div className="mt-1 text-xs text-slate-500">{relationName(handover.department)} · {handover.reason}</div></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold">{handover.status}</span></div><p className="mt-3 text-sm text-slate-700">{handover.note}</p>{handover.to_employee_id === actorId && handover.status === 'offen' && <button disabled={pending} onClick={() => acceptHandover(handover)} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white"><BadgeCheck size={14} /> Übergabe annehmen</button>}</article>)}</div></div>}
  </section>;
}

function MiniMetric({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) { return <div className={`rounded-2xl border bg-white p-3 ${danger ? 'border-red-200' : 'border-slate-200'}`}><div className={`text-lg font-extrabold ${danger ? 'text-red-700' : 'text-slate-950'}`}>{value}</div><div className="mt-1 text-[11px] font-medium text-slate-500">{label}</div></div>; }
function TeamPath({ organization }: { organization: OrganizationContext }) {
  const directManager = organization.leaders.at(-1);
  return <div className="mb-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-100 bg-slate-950 px-4 py-4 text-white sm:px-5">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-indigo-200"><UsersRound size={15} /> Mein Platz im Team</div>
      <p className="mt-1 text-sm text-slate-300">Deine Verantwortungslinie vom Betrieb bis zu deinem Team.</p>
    </div>
    <div className="p-4 sm:p-5">
      {organization.leaders.length > 0 ? <div className="space-y-0">
        {organization.leaders.map((person) => <div key={person.id} className="relative pb-5 pl-7 last:pb-4 before:absolute before:left-[9px] before:top-5 before:h-full before:w-px before:bg-indigo-200 last:before:h-5">
          <span className="absolute left-0 top-3 h-5 w-5 rounded-full border-4 border-white bg-indigo-400 ring-1 ring-indigo-200" />
          <TeamPersonCard person={person} />
        </div>)}
      </div> : <p className="mb-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">Noch keine Führungskraft hinterlegt.</p>}

      <div className="relative pl-7">
        <span className="absolute left-0 top-4 grid h-5 w-5 place-items-center rounded-full bg-emerald-600 text-white ring-4 ring-emerald-50"><CheckCircle2 size={12} /></span>
        <TeamPersonCard person={organization.self} current />
      </div>

      <div className="mt-4 grid gap-3 border-l border-dashed border-slate-300 pl-7 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Direkte Führung</div>
          <div className="mt-1 text-sm font-bold text-slate-800">{directManager ? `${directManager.vorname} ${directManager.nachname}` : 'Noch nicht zugeordnet'}</div>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Direkt zugeordnet</div>
          <div className="mt-1 text-sm font-bold text-slate-800">{organization.directReports.length ? `${organization.directReports.length} Mitarbeiter` : 'Keine Mitarbeiter'}</div>
        </div>
      </div>

      {organization.directReports.length > 0 && <div className="mt-4 pl-7">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Mein direktes Team</div>
        <div className="flex flex-wrap gap-2">{organization.directReports.map((person) => <span key={person.id} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">{person.vorname} {person.nachname}{person.position_title ? ` · ${person.position_title}` : ''}</span>)}</div>
      </div>}
    </div>
  </div>;
}
function TeamPersonCard({ person, current }: { person: TeamPerson; current?: boolean }) {
  return <div className={`rounded-2xl border px-4 py-3 ${current ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><div className={`text-sm font-extrabold ${current ? 'text-emerald-950' : 'text-slate-900'}`}>{person.vorname} {person.nachname}{current ? ' · Ich' : ''}</div><div className="mt-0.5 text-xs text-slate-500">{person.position_title || roleLabel(person.rolle)}</div></div>
      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${current ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-50 text-indigo-700'}`}>{roleLabel(person.rolle)}</span>
    </div>
  </div>;
}
function ActionButton({ children, onClick, disabled, success, danger }: { children: React.ReactNode; onClick: () => void; disabled: boolean; success?: boolean; danger?: boolean }) { return <button disabled={disabled} onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50 ${success ? 'bg-emerald-100 text-emerald-800' : danger ? 'bg-red-100 text-red-800' : 'bg-indigo-100 text-indigo-800'}`}>{children}</button>; }
function EvidenceUploader({ task, onUploaded }: { task: Task; onUploaded: (evidence: NonNullable<Task['evidence']>[number]) => void }) {
  const required = task.evidence_requirements ?? [];
  const submitted = new Set((task.evidence ?? []).map((item) => item.evidence_type));
  const firstMissing = required.find((item) => !submitted.has(item)) ?? required[0] ?? 'kommentar';
  const [type, setType] = useState(firstMissing);
  const [comment, setComment] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function upload() {
    setBusy(true); setMessage('');
    const form = new FormData(); form.set('taskId', task.id); form.set('evidenceType', type); form.set('comment', comment); if (file) form.set('file', file);
    const response = await fetch('/api/operations/responsibility/evidence', { method: 'POST', body: form });
    const result = await response.json().catch(() => null); setBusy(false);
    if (!response.ok) { setMessage(result?.error ?? 'Nachweis fehlgeschlagen.'); return; }
    onUploaded(result.evidence); setComment(''); setFile(null); setMessage('Nachweis gespeichert.');
  }
  return <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3"><div className="mb-2 text-xs font-bold text-indigo-950">Nachweis hinzufügen</div><div className="grid gap-2 sm:grid-cols-[140px_1fr_auto]"><select className="h-10 rounded-lg border border-indigo-200 bg-white px-2 text-xs" value={type} onChange={(event) => { setType(event.target.value); setFile(null); }}><option value="foto">Foto</option><option value="kommentar">Kommentar</option><option value="dokument">Dokument</option><option value="unterschrift">Unterschrift / Name</option><option value="messwert">Messwert</option></select>{['foto', 'dokument'].includes(type) ? <input className="h-10 rounded-lg border border-indigo-200 bg-white p-2 text-xs" type="file" accept={type === 'foto' ? 'image/jpeg,image/png,image/webp' : 'image/jpeg,image/png,image/webp,application/pdf'} onChange={(event) => setFile(event.target.files?.[0] ?? null)} /> : <input className="h-10 rounded-lg border border-indigo-200 bg-white px-3 text-xs" value={comment} onChange={(event) => setComment(event.target.value)} placeholder={type === 'messwert' ? 'z. B. 4,2 °C' : 'Nachweis eintragen'} />}<button disabled={busy || (['foto', 'dokument'].includes(type) ? !file : !comment.trim())} onClick={upload} className="h-10 rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white disabled:opacity-50">{busy ? 'Speichert …' : 'Speichern'}</button></div>{message && <div className="mt-2 text-xs font-semibold text-indigo-800">{message}</div>}</div>;
}
function relationName(value: { name: string } | { name: string }[] | null) { return Array.isArray(value) ? value[0]?.name ?? 'Standortweit' : value?.name ?? 'Standortweit'; }
function relationId(value: Responsibility['department']) { return Array.isArray(value) ? value[0]?.id ?? null : value?.id ?? null; }
function personName(value: { vorname: string; nachname: string } | { vorname: string; nachname: string }[] | null) { const person = Array.isArray(value) ? value[0] : value; return person ? `${person.vorname} ${person.nachname}` : 'Unbekannt'; }
function relationOne<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
function formatShift(shift: { start_zeit: string; end_zeit: string; position: string | null }) { const start = new Date(shift.start_zeit); const end = new Date(shift.end_zeit); const timeZone = 'Europe/Berlin'; return `${start.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone })} · ${start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone })}–${end.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone })}${shift.position ? ` · ${shift.position}` : ''}`; }
function roleLabel(role: string) {
  const labels: Record<string, string> = {
    admin: 'Geschäftsführung', backoffice: 'Betriebsleitung', manager: 'Filialleitung',
    teamleiter: 'Teamleitung', mitarbeiter: 'Mitarbeiter', server: 'Service',
    bartender: 'Bar', cook: 'Küche', dishwasher: 'Spülküche',
  };
  return labels[role] ?? role;
}
