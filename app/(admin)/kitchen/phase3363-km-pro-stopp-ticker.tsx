'use client';
import { useEffect, useState } from 'react';
import { Route, AlertTriangle, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  km_pro_stopp: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg: number;
  bester_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, km_pro_stopp: 1.2, rank_delta:  0, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, km_pro_stopp: 1.8, rank_delta:  1, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, km_pro_stopp: 2.5, rank_delta: -1, ampel: 'gelb',  alert_top: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, km_pro_stopp: 3.8, rank_delta:  0, ampel: 'rot',   alert_top: true  },
  ],
  team_avg: 2.33,
  bester_name: 'Julia F.',
  alert_count: 1,
  gesamt: 4,
};

function dotCls(a: string) {
  if (a === 'rot')  return 'bg-red-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-blue-500';
}

function textCls(a: string) {
  if (a === 'rot')  return 'text-red-600 dark:text-red-400';
  if (a === 'gelb') return 'text-amber-600 dark:text-amber-400';
  return 'text-blue-700 dark:text-blue-400';
}

export function KitchenPhase3363KmProStoppTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!locationId) { setData(MOCK); return; }
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-km-pro-stopp?location_id=${locationId}`);
        if (res.ok && active) setData(await res.json());
      } catch {
        if (active) setData(MOCK);
      }
    };
    load();
    const iv = setInterval(load, 30 * 60 * 1000);
    return () => { active = false; clearInterval(iv); };
  }, [locationId]);

  const d      = data ?? MOCK;
  const list   = [...d.fahrer].sort((a, b) => a.rang - b.rang);
  const bester = list.find(f => f.rang === 1);
  const alerts = list.filter(f => f.alert_top);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Route size={15} className="text-blue-600 flex-shrink-0" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate">
            km/Stopp
          </span>
          {bester && (
            <span className="text-xs text-blue-700 dark:text-blue-400 font-medium truncate">
              #{1} {bester.fahrer_name} {bester.km_pro_stopp.toFixed(2)} km
            </span>
          )}
          {alerts.length > 0 && (
            <span className="ml-1 inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 rounded-full px-2 py-0.5 flex-shrink-0">
              <AlertTriangle size={9} /> {alerts.length}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={15} className="text-gray-500 flex-shrink-0" /> : <ChevronDown size={15} className="text-gray-500 flex-shrink-0" />}
      </button>

      {open && (
        <div className="p-3 space-y-2">
          {alerts.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 dark:text-red-300 dark:bg-red-950 dark:border-red-800 text-xs font-semibold px-2.5 py-1.5">
              <AlertTriangle size={12} />
              {alerts.map(f => f.fahrer_name).join(', ')} — Hohe km/Stopp!
            </div>
          )}

          {list.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2 text-xs">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                f.rang === 1 ? 'bg-yellow-100 text-yellow-700' :
                f.rang === 2 ? 'bg-gray-100 text-gray-600' :
                f.rang === 3 ? 'bg-orange-100 text-orange-600' :
                'bg-gray-50 text-gray-500 dark:bg-gray-800'
              }`}>{f.rang}</span>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotCls(f.ampel)}`} />
              <span className="flex-1 font-medium text-gray-700 dark:text-gray-200 truncate">{f.fahrer_name}</span>
              <span className={`font-bold tabular-nums ${textCls(f.ampel)}`}>{f.km_pro_stopp.toFixed(2)} km</span>
              {f.rank_delta < 0
                ? <TrendingUp  size={11} className="text-green-500 flex-shrink-0" />
                : f.rank_delta > 0
                ? <TrendingDown size={11} className="text-red-400 flex-shrink-0" />
                : <Minus       size={11} className="text-gray-400 flex-shrink-0" />}
              {f.rank_delta !== 0 && (
                <span className={`tabular-nums ${f.rank_delta < 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {f.rank_delta > 0 ? '+' : ''}{f.rank_delta}
                </span>
              )}
            </div>
          ))}

          <div className="pt-1 border-t border-gray-100 dark:border-gray-700 flex justify-between text-xs text-gray-400">
            <span>Team-Ø: {d.team_avg.toFixed(2)} km/Stopp</span>
            <span>Ziel: &lt;2.0 km</span>
          </div>
        </div>
      )}
    </div>
  );
}
