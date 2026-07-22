'use client';
import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, ChevronDown, ChevronUp, Minus, TrendingDown, TrendingUp } from 'lucide-react';

interface RankEntry {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  auslastung_pct: number;
  rank_delta: number;
  ampel: string;
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: RankEntry[];
  team_avg_pct: number;
  bester_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, auslastung_pct: 92, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, auslastung_pct: 81, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, auslastung_pct: 68, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, auslastung_pct: 41, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_pct: 70,
  bester_name: 'Julia F.',
  alert_count: 1,
  gesamt: 4,
};

function dot(a: string) {
  if (a === 'rot')  return 'bg-red-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-green-500';
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta < 0) return <TrendingDown size={10} className="text-red-400"  />;
  if (delta > 0) return <TrendingUp   size={10} className="text-green-500" />;
  return               <Minus         size={10} className="text-gray-400"  />;
}

export function KitchenPhase3214AuslastungsTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-auslastung-ranking?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  const list   = data?.fahrer ?? [];
  const bester = list.find(f => f.rang === 1);
  const alerts = list.filter(f => f.alert_bottom);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-3 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Activity size={14} className="text-green-500 shrink-0" />
          <span className="font-semibold text-xs text-gray-800 dark:text-gray-100 truncate">
            Schicht-Auslastung
            {bester && (
              <span className="ml-1 font-normal text-green-600 dark:text-green-400">
                — Bester: {bester.fahrer_name} ({bester.auslastung_pct}%)
              </span>
            )}
          </span>
          {(data?.alert_count ?? 0) > 0 && (
            <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 rounded-full px-1.5 py-0.5">
              <AlertTriangle size={9} /> {data?.alert_count}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={14} className="text-gray-500 shrink-0" /> : <ChevronDown size={14} className="text-gray-500 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 py-3 space-y-1.5">
          {alerts.length > 0 && (
            <div className="flex items-center gap-1.5 rounded bg-red-50 border border-red-200 text-red-700 dark:text-red-300 dark:bg-red-950 dark:border-red-800 text-xs font-semibold px-2 py-1.5 mb-2">
              <AlertTriangle size={11} />
              {alerts.map(f => f.fahrer_name).join(', ')} — Niedrige Auslastung!
            </div>
          )}

          {list.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2 text-xs py-0.5">
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold shrink-0 ${
                f.rang === 1 ? 'bg-yellow-100 text-yellow-700' :
                f.rang === 2 ? 'bg-gray-100 text-gray-600' :
                f.rang === 3 ? 'bg-orange-100 text-orange-600' :
                'bg-white border border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400'
              }`}>{f.rang}</span>
              <span className={`w-2 h-2 rounded-full shrink-0 ${dot(f.ampel)}`} />
              <span className="font-medium text-gray-700 dark:text-gray-200 flex-1 truncate">{f.fahrer_name}</span>
              <span className="font-semibold text-gray-800 dark:text-gray-100 shrink-0">{f.auslastung_pct}%</span>
              <DeltaIcon delta={f.rank_delta} />
              {f.rank_delta !== 0 && (
                <span className={`text-xs shrink-0 ${f.rank_delta > 0 ? 'text-green-500' : 'text-red-400'}`}>
                  {f.rank_delta > 0 ? `+${f.rank_delta}` : `${f.rank_delta}`}
                </span>
              )}
            </div>
          ))}

          <div className="pt-1 flex items-center gap-1.5 text-xs text-gray-400">
            <Activity size={10} className="text-green-400" />
            <span>Ø {data?.team_avg_pct ?? 0}% Team · Rang 1 = höchste Auslastung</span>
          </div>
        </div>
      )}
    </div>
  );
}
