import { GraduationCap, LogOut, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { trainingStatus, trainingStatusLabels } from '@/lib/training/domain';

export type OnboardingTraining = {
  id: string;
  status: string;
  due_at: string | null;
  fortschritt_prozent: number | null;
  module: { titel: string; dauer_minuten: number | null } | { titel: string; dauer_minuten: number | null }[] | null;
};

function moduleOf(training: OnboardingTraining) {
  return Array.isArray(training.module) ? training.module[0] ?? null : training.module;
}

/**
 * Onboarding-Modus: Neue Mitarbeiter sehen ausschließlich ihre Pflichtschulungen,
 * bis alle bestanden sind. Dann schaltet der DB-Trigger die volle App frei.
 */
export function OnboardingGate({ vorname, tenantName, trainings }: { vorname: string; tenantName: string; trainings: OnboardingTraining[] }) {
  const total = trainings.length;
  const passed = trainings.filter((t) => t.status === 'bestanden').length;
  const open = trainings.filter((t) => t.status !== 'bestanden');
  const next = open[0] ?? null;
  const pct = total === 0 ? 0 : Math.round((passed / total) * 100);

  return (
    <main className="min-h-[100dvh] bg-slate-100 text-slate-950">
      <div className="mx-auto min-h-[100dvh] max-w-3xl bg-slate-100 pb-12">
        <header className="bg-slate-950 px-5 pb-20 pt-[max(1.25rem,env(safe-area-inset-top))] text-white sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-lg font-bold tracking-tight">mise team</div>
              <div className="text-xs text-slate-300">{tenantName}</div>
            </div>
            <form action="/auth/signout" method="post">
              <button className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-semibold">
                <LogOut size={15} /> Abmelden
              </button>
            </form>
          </div>
          <h1 className="mt-8 text-3xl font-bold tracking-tight">Willkommen, {vorname}.</h1>
          <p className="mt-2 max-w-md text-[15px] leading-relaxed text-slate-300">
            Bevor du Schichten, Aufgaben und Checklisten siehst, gehst du deine Einarbeitung durch. Sobald alle Pflichtschulungen bestanden sind, wird deine App automatisch freigeschaltet – du bekommst dann eine E-Mail.
          </p>
        </header>

        <section className="-mt-12 px-4 sm:px-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-bold"><GraduationCap size={18} className="text-emerald-700" /> Deine Einarbeitung</div>
              <div className="text-sm font-semibold text-slate-600">{passed}/{total} bestanden</div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-emerald-600 transition-[width]" style={{ width: `${pct}%` }} />
            </div>
            {next && (
              <a
                href={`/mitarbeiter/schulungen/${next.id}`}
                className="mt-5 flex h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-700 text-[16px] font-bold text-white hover:bg-emerald-800"
              >
                {next.status === 'begonnen' ? 'Weiter mit' : 'Starten mit'} „{moduleOf(next)?.titel ?? 'Schulung'}“ <ArrowRight size={18} />
              </a>
            )}
          </div>
        </section>

        <section className="mt-6 px-4 sm:px-8">
          <h2 className="mb-3 text-base font-bold tracking-tight">Alle Pflichtschulungen</h2>
          <ol className="space-y-2">
            {trainings.map((training, index) => {
              const mod = moduleOf(training);
              const visible = trainingStatus(training.status, training.due_at);
              const done = training.status === 'bestanden';
              return (
                <li key={training.id}>
                  <a href={`/mitarbeiter/schulungen/${training.id}`} className={`flex items-center gap-3 rounded-2xl border bg-white p-4 ${done ? 'border-emerald-200' : 'border-slate-200 hover:border-slate-300'}`}>
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${done ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                      {done ? <CheckCircle2 size={18} /> : index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{mod?.titel ?? 'Schulung'}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                        {mod?.dauer_minuten ? <span className="inline-flex items-center gap-1"><Clock size={12} /> {mod.dauer_minuten} Min.</span> : null}
                        {training.due_at ? <span>fällig {new Date(training.due_at).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })}</span> : null}
                      </span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${done ? 'bg-emerald-100 text-emerald-800' : visible === 'ueberfaellig' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'}`}>
                      {trainingStatusLabels[visible] ?? visible}
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>
          <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">Fragen zur Einarbeitung? Deine Schichtleitung hilft dir weiter.</p>
        </section>
      </div>
    </main>
  );
}
