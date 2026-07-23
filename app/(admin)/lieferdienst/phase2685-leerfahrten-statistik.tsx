'use client';
import { useEffect, useState } from 'react';
import { Route, AlertTriangle, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  leerfahrten: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_leerfahrten: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, leerfahrten: 0, rank_delta: -1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, leerfahrten: 0, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, leerfahrten: 1, rank_delta:  1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, leerfahrten: 3, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_leerfahrten: 1,
  bester_name: 'Max M.',
  letzter_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

export function LieferdienstPhase2685LeerfahrtenStatistik({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!locationId) { setData(MOCK); return; }
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-leerfahrten-ranking?location_id=${locationId}`);
        if (res.ok && active) setData(await res.json());
      } catch {
        if (active) setData(MOCK);
      }
    };
    load();
    const iv = setInterval(load, 30 * 60 * 1000);
    return () => { active = false; clearInterval(iv); };
  }, [locationId]);

  const d    = data ?? MOCK;
  const list = [...d.fahrer].sort((a, b) => a.rang - b.rang);
  const alerts = list.filter(f => f.alert_bottom);
  const bester = list.find(f => f.rang === 1);
  const totalLF = list.reduce((s, f) => s + f.leerfahrten, 0);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Route size={16} className="text-orange-600" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
            Leerfahrten-Statistik
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
            Gesamt: {totalLF} heute
          </span>
          {alerts.length > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 rounded-full px-2 py-0.5">
              <AlertTriangle size={10} /> {alerts.length}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {alerts.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 text-red-700 dark:text-red-300 dark:bg-red-950 dark:border-red-800 text-xs font-semibold px-3 py-2">
              <AlertTriangle size={14} />
              {alerts.map(f => f.fahrer_name).join(', ')} — Hohe Leerfahrten-Anzahl!
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium mb-0.5">Gesamt LF</div>
              <div className="font-bold text-lg text-orange-700 dark:text-orange-400">{totalLF}</div>
              <div className="text-xs text-gray-500">heute</div>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium mb-0.5">Team-Ø</div>
              <div className="font-bold text-lg text-gray-700 dark:text-gray-200">{d.team_avg_leerfahrten}</div>
              <div className="text-xs text-gray-500">pro Fahrer</div>
            </div>
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium mb-0.5">Bester</div>
              <div className="font-bold text-sm text-green-700 dark:text-green-400">{bester?.fahrer_name ?? '—'}</div>
              <div className="text-xs text-gray-500">{bester?.leerfahrten ?? 0} LF</div>
            </div>
          </div>

          <div className="space-y-1.5">
            {list.map(f => (
              <div key={f.fahrer_id} className="flex items-center gap-2 text-xs py-1 border-b border-gray-50 dark:border-gray-800 last:border-0">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  f.rang === 1 ? 'bg-yellow-100 text-yellow-700' :
                  f.rang === 2 ? 'bg-gray-100 text-gray-600' :
                  f.rang === 3 ? 'bg-orange-100 text-orange-600' :
                  'bg-gray-50 text-gray-500 dark:bg-gray-800'
                }`}>{f.rang}</span>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${f.ampel === 'rot' ? 'bg-red-500' : f.ampel === 'gelb' ? 'bg-amber-400' : 'bg-green-500'}`} />
                <span className="flex-1 font-medium text-gray-700 dark:text-gray-200 truncate">{f.fahrer_name}</span>
                <span className={`font-bold tabular-nums ${f.ampel === 'rot' ? 'text-red-600 dark:text-red-400' : f.ampel === 'gelb' ? 'text-amber-600 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}`}>
                  {f.leerfahrten} LF
                </span>
                {f.rank_delta < 0
                  ? <TrendingUp  size={11} className="text-green-500 flex-shrink-0" />
                  : f.rank_delta > 0
                  ? <TrendingDown size={11} className="text-red-400 flex-shrink-0" />
                  : <Minus       size={11} className="text-gray-400 flex-shrink-0" />}
              </div>
            ))}
          </div>

          <div className="pt-1 border-t border-gray-100 dark:border-gray-700 flex justify-between text-xs text-gray-400">
            <span>{d.gesamt} Fahrer aktiv heute</span>
            <span>Ziel: 0 Leerfahrten/Fahrer</span>
          </div>
        </div>
      )}
    </div>
  );
}
