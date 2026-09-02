import { ClipboardCheck, ArrowRight, AlertTriangle } from 'lucide-react';

export type PflichtTask = {
  id: string;
  title: string;
  status: string;
  due_at: string | null;
  shift_id: string | null;
  source_type: string | null;
  source_id: string | null;
  escalation_level: number | null;
};

const TIME = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
const DAY = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' });

/** source_id = 'shift_guide:<shift>:<guide>:<mitarbeiter>' → Leitfaden-ID */
export function guideIdOf(task: PflichtTask): string | null {
  const parts = (task.source_id ?? '').split(':');
  return parts.length >= 3 && parts[0] === 'shift_guide' ? parts[2]! : null;
}

export function pflichtHref(task: PflichtTask): string {
  const guideId = guideIdOf(task);
  return guideId ? `/neo/app/ablaeufe/schichtleitfaeden/${guideId}/ausfuehren?task=${task.id}` : '/mitarbeiter#pflicht';
}

/**
 * „Pflicht heute“: automatisch erzeugte Schicht-Checklisten. Wer sie nicht bis zur Fälligkeit
 * abschließt, landet als Pflichtkontrolle bei der Filialleitung – das steht hier klar drin.
 */
function ProgressRing({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : done / total;
  const r = 15.5;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-grid h-10 w-10 place-items-center" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} aria-label={`${done} von ${total} Checklisten erledigt`}>
      <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" strokeWidth="4" className="stroke-slate-200" />
        <circle cx="18" cy="18" r={r} fill="none" strokeWidth="4" strokeLinecap="round" className={pct >= 1 ? 'stroke-emerald-600' : 'stroke-slate-800'} strokeDasharray={`${c * pct} ${c}`} />
      </svg>
      <span className="absolute text-[10px] font-bold">{done}/{total}</span>
    </span>
  );
}

export function PflichtHeute({ tasks, now, doneToday = 0, stepCounts }: { tasks: PflichtTask[]; now: Date; doneToday?: number; stepCounts?: Record<string, number> }) {
  // Alles erledigt: der 100-%-Moment bleibt sichtbar
  if (tasks.length === 0 && doneToday > 0) {
    return (
      <section id="pflicht" className="mt-6 scroll-mt-20 px-4 sm:px-8" aria-labelledby="pflicht-title">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <h2 id="pflicht-title" className="flex items-center gap-2 text-base font-bold tracking-tight">
            <ClipboardCheck size={18} className="text-emerald-700" /> Alle Checklisten heute erledigt
          </h2>
          <ProgressRing done={doneToday} total={doneToday} />
        </div>
      </section>
    );
  }
  if (tasks.length === 0) return null;
  const overdue = tasks.filter((t) => t.due_at && Date.parse(t.due_at) < now.getTime());
  const dueSoon = tasks.filter((t) => t.due_at && Date.parse(t.due_at) >= now.getTime() && Date.parse(t.due_at) < now.getTime() + 2 * 3_600_000);
  // Ampel: rot pulsiert bei überfällig, gelb wenn in < 2 h fällig, sonst grün
  const tone = overdue.length ? 'red' : dueSoon.length ? 'amber' : 'green';
  const frame = tone === 'red' ? 'border-red-300 bg-red-50 animate-pulse [animation-duration:2.5s]' : tone === 'amber' ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-emerald-50';
  return (
    <section id="pflicht" className="mt-6 scroll-mt-20 px-4 sm:px-8" aria-labelledby="pflicht-title">
      <div className={`rounded-2xl border p-4 ${frame}`}>
        <div className="flex items-center justify-between gap-3">
          <h2 id="pflicht-title" className="flex items-center gap-2 text-base font-bold tracking-tight">
            {tone === 'red' ? <AlertTriangle size={18} className="text-red-700" /> : <ClipboardCheck size={18} className={tone === 'amber' ? 'text-amber-700' : 'text-emerald-700'} />}
            {tone === 'red' ? `${overdue.length} Checkliste${overdue.length === 1 ? '' : 'n'} überfällig` : tone === 'amber' ? 'Gleich fällig: Pflicht in deiner Schicht' : 'Pflicht in deiner Schicht'}
          </h2>
          <ProgressRing done={doneToday} total={doneToday + tasks.length} />
        </div>
        <ul className="mt-3 space-y-2">
          {tasks.map((task) => {
            const late = !!task.due_at && Date.parse(task.due_at) < now.getTime();
            const started = task.status === 'in_arbeit';
            return (
              <li key={task.id}>
                <a href={pflichtHref(task)} className="flex items-center gap-3 rounded-xl border border-white/60 bg-white p-3 shadow-sm hover:border-slate-300">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{task.title}</span>
                    <span className={`mt-0.5 block text-xs ${late ? 'font-semibold text-red-700' : 'text-slate-500'}`}>
                      {task.due_at ? `${late ? 'War fällig' : 'Fällig'} ${DAY.format(new Date(task.due_at))} ${TIME.format(new Date(task.due_at))} Uhr` : 'Heute in deiner Schicht'}
                      {stepCounts?.[task.id] ? ` · ${stepCounts[task.id]} Schritte` : ''}
                      {late && (task.escalation_level ?? 0) > 0 ? ' · Filialleitung ist informiert' : started ? ' · begonnen' : ''}
                    </span>
                  </span>
                  <span className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl bg-slate-950 px-3 text-xs font-bold text-white">
                    {started ? 'Weiter' : 'Durchgehen'} <ArrowRight size={14} />
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-600">Checklisten sind Pflicht. Wird eine nicht rechtzeitig abgeschlossen, erscheint sie bei deiner Filialleitung als Kontrolle.</p>
      </div>
    </section>
  );
}
