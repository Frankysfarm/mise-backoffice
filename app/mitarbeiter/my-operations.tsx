'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, ArrowRight, BadgeCheck, CheckCircle2, ClipboardCheck, ShieldCheck, UsersRound } from 'lucide-react';

type Responsibility = {
  id: string; responsibility_role: string; weekday_scope: number[]; shift_start: string | null; shift_end: string | null;
  department: { id: string; name: string } | { id: string; name: string }[] | null;
};
type Task = {
  id: string; title: string; description: string | null; status: string; priority: number; due_at: string | null;
  completed_at: string | null; evidence_requirements: string[] | null; escalation_level: number;
  assigned_to: string | null; accountable_employee_id: string; controller_employee_id: string | null;
  department: { name: string } | { name: string }[] | null;
  evidence: { id: string; evidence_type: string; verification_status: string; submitted_at: string }[] | null;
};
type Handover = {
  id: string; reason: string; starts_at: string; ends_at: string | null; note: string; status: string;
  from_employee_id: string; to_employee_id: string;
  department: { name: string } | { name: string }[] | null;
  from_employee: { vorname: string; nachname: string } | { vorname: string; nachname: string }[] | null;
  to_employee: { vorname: string; nachname: string } | { vorname: string; nachname: string }[] | null;
};
type Subordinate = { id: string; vorname: string; nachname: string; position_title: string | null };

const openStates = new Set(['offen', 'angenommen', 'in_arbeit', 'wartet_auf_pruefung', 'blockiert']);
const statusLabel: Record<string, string> = { offen: 'Offen', angenommen: 'Angenommen', in_arbeit: 'In Arbeit', wartet_auf_pruefung: 'Prüfung offen', erledigt: 'Freigegeben', nicht_bestanden: 'Nicht bestanden', blockiert: 'Blockiert' };

export function MyOperations({ actorId, locationId, responsibilities, tasks: initialTasks, handovers: initialHandovers, subordinates }: { actorId: string; locationId: string; responsibilities: Responsibility[]; tasks: Task[]; handovers: Handover[]; subordinates: Subordinate[] }) {
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

  return <section className="mt-9 px-4 sm:px-8" aria-labelledby="operations-title">
    <div className="mb-4 flex items-end justify-between gap-3"><div><div className="text-xs font-bold uppercase tracking-[.14em] text-indigo-700">Verantwortung</div><h2 id="operations-title" className="mt-1 text-xl font-bold tracking-tight">Mein Bereich heute</h2></div><ShieldCheck className="text-slate-400" size={22} /></div>
    {error && <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</div>}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <MiniMetric label="Bereiche" value={responsibilities.length} /><MiniMetric label="Offen" value={active.length} /><MiniMetric label="Überfällig" value={overdue.length} danger={overdue.length > 0} /><MiniMetric label="Kontrolle" value={controls.length} /><MiniMetric label="Qualität" value={`${quality}%`} />
    </div>

    {(responsibilities.length > 0 || subordinates.length > 0) && <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4"><div className="flex items-center gap-2 text-sm font-bold text-indigo-950"><ShieldCheck size={16} /> Meine Verantwortungsbereiche</div><div className="mt-3 flex flex-wrap gap-2">{responsibilities.map((item) => <span key={item.id} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-indigo-800 shadow-sm">{relationName(item.department)} · {item.responsibility_role === 'hauptverantwortung' ? 'Verantwortung' : 'Vertretung'}</span>)}</div></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-sm font-bold"><UsersRound size={16} /> Direkt zugeordnet</div>{subordinates.length ? <div className="mt-3 flex flex-wrap gap-2">{subordinates.map((person) => <span key={person.id} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">{person.vorname} {person.nachname}{person.position_title ? ` · ${person.position_title}` : ''}</span>)}</div> : <p className="mt-2 text-xs text-slate-500">Keine direkt zugeordneten Mitarbeiter.</p>}</div>
    </div>}

    {(overdue.length > 0 || failed.length > 0 || escalations.length > 0) && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4"><div className="flex items-center gap-2 text-sm font-bold text-red-900"><AlertTriangle size={17} /> Aufmerksamkeit erforderlich</div><p className="mt-1 text-xs text-red-800">{overdue.length} überfällig · {failed.length} nicht bestanden · {escalations.length} eskaliert</p></div>}

    <div className="mt-4 space-y-3">
      {active.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-7 text-center text-sm text-slate-500"><CheckCircle2 className="mx-auto mb-2 text-emerald-600" size={24} />Aktuell sind keine betrieblichen Aufgaben offen.</div>}
      {active.map((task) => { const isOverdue = Boolean(task.due_at && new Date(task.due_at) < new Date()); const mayReview = task.status === 'wartet_auf_pruefung' && (task.accountable_employee_id === actorId || task.controller_employee_id === actorId); return <article key={task.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${isOverdue ? 'border-red-200' : 'border-slate-200'}`}><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="text-xs font-bold uppercase tracking-wide text-indigo-700">{relationName(task.department)}</div><h3 className="mt-1 font-bold">{task.title}</h3></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${isOverdue ? 'bg-red-100 text-red-800' : task.status === 'wartet_auf_pruefung' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>{statusLabel[task.status] ?? task.status}</span></div>{task.description && <p className="mt-2 text-sm text-slate-600">{task.description}</p>}<div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">{task.due_at && <span className={isOverdue ? 'font-bold text-red-700' : ''}>Fällig {new Date(task.due_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</span>}{task.evidence_requirements?.length ? <span>Nachweis: {task.evidence_requirements.join(', ')}</span> : null}{task.evidence?.length ? <span className="font-semibold text-emerald-700">{task.evidence.length} Nachweis(e) erfasst</span> : null}{task.escalation_level > 0 && <span className="font-bold text-red-700">Eskalation {task.escalation_level}</span>}</div>{task.assigned_to === actorId && ['angenommen', 'in_arbeit', 'blockiert'].includes(task.status) && <EvidenceUploader task={task} onUploaded={(evidence) => addEvidence(task.id, evidence)} />}<div className="mt-3 flex flex-wrap gap-2">{task.assigned_to === actorId && task.status === 'offen' && <ActionButton disabled={pending} onClick={() => updateTask(task, 'angenommen')}>Annehmen</ActionButton>}{task.assigned_to === actorId && task.status === 'angenommen' && <ActionButton disabled={pending} onClick={() => updateTask(task, 'in_arbeit')}>Starten</ActionButton>}{task.assigned_to === actorId && ['angenommen', 'in_arbeit', 'blockiert'].includes(task.status) && <ActionButton disabled={pending} onClick={() => updateTask(task, 'wartet_auf_pruefung')}>Zur Prüfung einreichen <ArrowRight size={13} /></ActionButton>}{mayReview && <><ActionButton disabled={pending} onClick={() => updateTask(task, 'erledigt')} success>Prüfen & freigeben</ActionButton><ActionButton disabled={pending} onClick={() => updateTask(task, 'nicht_bestanden')} danger>Nicht bestanden</ActionButton></>}</div></article>; })}
    </div>

    {handovers.length > 0 && <div className="mt-7"><div className="mb-3 flex items-center gap-2 text-sm font-bold"><BadgeCheck size={17} /> Meine Übergaben</div><div className="space-y-3">{handovers.map((handover) => <article className="rounded-2xl border border-slate-200 bg-white p-4" key={handover.id}><div className="flex flex-wrap items-start justify-between gap-2"><div><strong className="text-sm">{personName(handover.from_employee)} → {personName(handover.to_employee)}</strong><div className="mt-1 text-xs text-slate-500">{relationName(handover.department)} · {handover.reason}</div></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold">{handover.status}</span></div><p className="mt-3 text-sm text-slate-700">{handover.note}</p>{handover.to_employee_id === actorId && handover.status === 'offen' && <button disabled={pending} onClick={() => acceptHandover(handover)} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white"><BadgeCheck size={14} /> Übergabe annehmen</button>}</article>)}</div></div>}
  </section>;
}

function MiniMetric({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) { return <div className={`rounded-2xl border bg-white p-3 ${danger ? 'border-red-200' : 'border-slate-200'}`}><div className={`text-lg font-extrabold ${danger ? 'text-red-700' : 'text-slate-950'}`}>{value}</div><div className="mt-1 text-[11px] font-medium text-slate-500">{label}</div></div>; }
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
function personName(value: { vorname: string; nachname: string } | { vorname: string; nachname: string }[] | null) { const person = Array.isArray(value) ? value[0] : value; return person ? `${person.vorname} ${person.nachname}` : 'Unbekannt'; }
