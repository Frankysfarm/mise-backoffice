'use client';
import * as React from 'react';
import { Check, Heart, X } from 'lucide-react';

type OpenShift = { id: string; start_zeit: string; end_zeit: string; position: string | null; department: { name: string } | { name: string }[] | null };
export function AvailabilityLoop({ shifts, initial }: { shifts: OpenShift[]; initial: { shift_id: string; state: string; applied: boolean }[] }) {
  const [states, setStates] = React.useState(() => new Map(initial.map(row => [row.shift_id, { state: row.state, applied: row.applied }])));
  const [busy, setBusy] = React.useState('');
  async function choose(shiftId: string, state: 'kann' | 'moechte' | 'kann_nicht', applied = false) {
    setBusy(shiftId); const response = await fetch('/api/scheduling/planner', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'availability', shiftId, state, applied }) }); setBusy('');
    if (response.ok) setStates(current => new Map(current).set(shiftId, { state, applied }));
  }
  return <section id="verfuegbarkeit" className="mt-8 scroll-mt-20 px-4 sm:px-8"><div className="mb-4"><div className="text-xs font-bold uppercase tracking-[.14em] text-sky-700">Planungsrunde</div><h2 className="mt-1 text-xl font-bold">Wann kannst du arbeiten?</h2><p className="mt-1 text-sm text-slate-500">Deine Rückmeldung ist noch keine feste Zusage. Mit „möchte“ bewirbst du dich für die Schicht.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">{shifts.length === 0 && <div className="rounded-2xl border border-dashed p-6 text-sm text-slate-500">Aktuell sind keine offenen Schichten zur Rückmeldung freigegeben.</div>}{shifts.map(shift => { const selected = states.get(shift.id); const department = Array.isArray(shift.department) ? shift.department[0] : shift.department; return <article key={shift.id} className="rounded-2xl border bg-white p-4"><div className="font-bold">{new Date(shift.start_zeit).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div><div className="text-sm text-slate-500">{shift.position || department?.name || 'Offene Schicht'} · bis {new Date(shift.end_zeit).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })}</div><div className="mt-3 grid grid-cols-3 gap-2">
      <button disabled={busy === shift.id} onClick={() => choose(shift.id, 'kann')} className={`rounded-xl border px-2 py-2 text-xs font-bold ${selected?.state === 'kann' ? 'border-emerald-500 bg-emerald-50' : ''}`}><Check className="mx-auto mb-1" size={15}/>Kann</button>
      <button disabled={busy === shift.id} onClick={() => choose(shift.id, 'moechte', true)} className={`rounded-xl border px-2 py-2 text-xs font-bold ${selected?.state === 'moechte' ? 'border-sky-500 bg-sky-50' : ''}`}><Heart className="mx-auto mb-1" size={15}/>Möchte</button>
      <button disabled={busy === shift.id} onClick={() => choose(shift.id, 'kann_nicht')} className={`rounded-xl border px-2 py-2 text-xs font-bold ${selected?.state === 'kann_nicht' ? 'border-rose-500 bg-rose-50' : ''}`}><X className="mx-auto mb-1" size={15}/>Kann nicht</button>
    </div></article>; })}</div></section>;
}
