'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface RankEntry {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_sek: number;
  rank_delta: number;
  ampel: string;
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: RankEntry[];
  team_avg_sek: number;
  bester_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, avg_sek: 45,  rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, avg_sek: 62,  rank_delta: -5, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, avg_sek: 90,  rank_delta:  8, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_sek: 148, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_sek: 86,
  bester_name: 'Max M.',
  alert_count: 1,
  gesamt: 4,
};

function fmt(sek: number) {
  if (sek < 60) return `${sek}s`;
  return `${Math.floor(sek / 60)}m ${sek % 60}s`;
}

function dot(a: string) {
  if (a === 'rot')  return 'bg-red-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-green-500';
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta < 0) return <TrendingUp  size={10} className="text-green-500" />;
  if (delta > 0) return <TrendingDown size={10} className="text-red-400"  />;
  return               <Minus        size={10} className="text-gray-400" />;
}

export function KitchenPhase3104ReaktionszeitTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-reaktionszeit-ranking?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  const list    = data?.fahrer ?? [];
  const bester  = list.find(f => f.rang === 1);
  const alerts  = list.filter(f => f.alert_bottom);
  const teamAvg = data?.team_avg_sek ?? 0;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
            Reaktionszeit · #1 {bester?.fahrer_name ?? data?.bester_name ?? '—'} ({bester ? fmt(bester.avg_sek) : '—'})
          </span>
          {(data?.alert_count ?? 0) > 0 && (
            <span className="ml-1 inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 rounded-full px-2 py-0.5">
              <AlertTriangle size={10} /> {data?.alert_count}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 py-3 space-y-2">
          {/* Alert-Banner */}
          {alerts.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2">
              <AlertTriangle size={12} />
              {alerts.map(f => f.fahrer_name).join(', ')} — Längste Reaktionszeit!
            </div>
          )}

          {/* Fahrerliste kompakt */}
          <div className="space-y-1.5">
            {list.map(f => (
              <div key={f.fahrer_id} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-600 dark:text-gray-300 w-5 text-right">#{f.rang}</span>
                  <span className={`w-2 h-2 rounded-full ${dot(f.ampel)}`} />
                  <span className="text-gray-700 dark:text-gray-200 font-medium">{f.fahrer_name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Zap size={9} className="text-gray-400" />
                  <span className="font-semibold text-gray-700 dark:text-gray-200">{fmt(f.avg_sek)}</span>
                  <DeltaIcon delta={f.rank_delta} />
                  {f.rank_delta !== 0 && (
                    <span className={f.rank_delta < 0 ? 'text-green-600' : 'text-red-400'}>
                      {f.rank_delta < 0 ? `${f.rank_delta}s` : `+${f.rank_delta}s`}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="text-xs text-gray-400 pt-1">Team-Ø {fmt(teamAvg)} · Ziel Top 25% (kürzeste Zeit)</div>
        </div>
      )}
    </div>
  );
}
