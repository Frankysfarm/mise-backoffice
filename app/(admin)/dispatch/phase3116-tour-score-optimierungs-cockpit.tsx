'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Sparkles, Target, TrendingUp } from 'lucide-react';

interface OptimierungsTipp {
  fahrer_id: string;
  fahrer_name: string;
  aktueller_score: number;
  potenzial_score: number;
  tipp: string;
  prioritaet: 'hoch' | 'mittel' | 'niedrig';
}

interface ApiData {
  tipps: OptimierungsTipp[];
  team_score: number;
  optimierungs_potenzial_pct: number;
  alert: string | null;
}

const MOCK: ApiData = {
  tipps: [
    { fahrer_id: 'f3', fahrer_name: 'Lars K.', aktueller_score: 62, potenzial_score: 80, tipp: 'Kürzere Route über Innenstadt wählen', prioritaet: 'hoch' },
    { fahrer_id: 'f4', fahrer_name: 'Sara B.', aktueller_score: 44, potenzial_score: 70, tipp: 'Stopp-Reihenfolge optimieren — Kundennähe beachten', prioritaet: 'hoch' },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', aktueller_score: 83, potenzial_score: 90, tipp: 'Wenige Leerfahrten zwischen Stopps einsparen', prioritaet: 'mittel' },
  ],
  team_score: 70,
  optimierungs_potenzial_pct: 18,
  alert: '2 Fahrer mit Score unter 65',
};

const PRIO_STYLE: Record<string, string> = {
  hoch: 'border-l-4 border-red-400 bg-red-50 dark:bg-red-950',
  mittel: 'border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-950',
  niedrig: 'border-l-4 border-emerald-400 bg-emerald-50 dark:bg-emerald-950',
};
const PRIO_LABEL: Record<string, string> = {
  hoch: 'text-red-600 dark:text-red-400',
  mittel: 'text-amber-600 dark:text-amber-400',
  niedrig: 'text-emerald-600 dark:text-emerald-400',
};

export function DispatchPhase3116TourScoreOptimierungsCockpit() {
  const [data, setData] = useState<ApiData>(MOCK);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/delivery/admin/tour-score-optimierung', { cache: 'no-store' });
        if (res.ok) setData(await res.json());
      } catch {}
    }
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="rounded-xl border bg-white dark:bg-zinc-900 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-500" />
          <span className="font-semibold text-sm">Tour-Score Optimierungs-Cockpit</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          <TrendingUp className="w-3.5 h-3.5" /> +{data.optimierungs_potenzial_pct}% Potenzial
        </div>
      </div>

      {data.alert && (
        <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {data.alert}
        </div>
      )}

      <div className="flex items-center gap-3 text-center">
        <div className="flex-1 rounded-lg bg-zinc-50 dark:bg-zinc-800 p-2">
          <div className="text-xl font-bold">{data.team_score}</div>
          <div className="text-xs text-zinc-500">Team-Score Ø</div>
        </div>
        <div className="flex-1 rounded-lg bg-emerald-50 dark:bg-emerald-950 p-2">
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {Math.round(data.team_score * (1 + data.optimierungs_potenzial_pct / 100))}
          </div>
          <div className="text-xs text-zinc-500">Erreichbar</div>
        </div>
      </div>

      {data.tipps.length === 0 ? (
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm">
          <CheckCircle2 className="w-4 h-4" /> Alle Touren gut optimiert
        </div>
      ) : (
        <div className="space-y-2">
          {data.tipps.map((t) => (
            <div key={t.fahrer_id} className={`rounded-lg px-3 py-2 ${PRIO_STYLE[t.prioritaet]}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-xs">{t.fahrer_name}</span>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-500">{t.aktueller_score}</span>
                  <span>→</span>
                  <span className={`font-bold ${PRIO_LABEL[t.prioritaet]}`}>{t.potenzial_score}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-300">
                <Target className="w-3 h-3 shrink-0" /> {t.tipp}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
