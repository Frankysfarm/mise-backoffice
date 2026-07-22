'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  jahre_pct: number[];
  aktuell_pct: number;
  trend: string;
  trend_delta: number;
  ampel: string;
  alert_negativ: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_pct: number;
  team_avg_pct_vorjahr: number;
  team_avg_pct_vorvorjahr: number;
  alert_count: number;
  jahre: number[];
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   jahre_pct: [60.0, 63.5, 67.1], aktuell_pct: 67.1, trend: 'steigend', trend_delta:  7.1, ampel: 'gruen', alert_negativ: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', jahre_pct: [55.0, 60.2, 64.2], aktuell_pct: 64.2, trend: 'steigend', trend_delta:  9.2, ampel: 'gruen', alert_negativ: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  jahre_pct: [58.0, 54.3, 52.7], aktuell_pct: 52.7, trend: 'fallend',  trend_delta: -5.3, ampel: 'rot',   alert_negativ: true  },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   jahre_pct: [45.0, 41.2, 37.5], aktuell_pct: 37.5, trend: 'fallend',  trend_delta: -7.5, ampel: 'rot',   alert_negativ: true  },
  ],
  team_avg_pct: 55.4,
  team_avg_pct_vorjahr: 54.8,
  team_avg_pct_vorvorjahr: 54.5,
  alert_count: 2,
  jahre: [2024, 2025, 2026],
};

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',     dot: 'bg-red-500',   text: 'text-red-700',   bar: 'bg-red-500'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' };
  return                   { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700', bar: 'bg-green-500' };
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={12} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={12} className="text-red-500"   />;
  return                           <Minus        size={12} className="text-gray-400"  />;
}

function SparklineBars({ pcts, jahre }: { pcts: number[]; jahre: number[] }) {
  const max = Math.max(...pcts, 10);
  return (
    <div className="flex items-end gap-1 h-8">
      {pcts.map((p, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5">
          <div
            className={`w-4 rounded-sm transition-all ${i === pcts.length - 1 ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
            style={{ height: `${Math.max(2, Math.round((p / max) * 28))}px` }}
            title={`${jahre[i]}: ${p.toFixed(1)}%`}
          />
          <span className="text-gray-400 dark:text-gray-500" style={{ fontSize: '9px' }}>{String(jahre[i]).slice(2)}</span>
        </div>
      ))}
    </div>
  );
}

export function DispatchPhase3071MehrjahresTrendBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-mehrjahres-trend?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  const list      = data?.fahrer ?? [];
  const teamAkt   = data?.team_avg_pct ?? 0;
  const teamVj    = data?.team_avg_pct_vorjahr ?? 0;
  const teamVvj   = data?.team_avg_pct_vorvorjahr ?? 0;
  const alerts    = list.filter(f => f.alert_negativ);
  const jahre     = data?.jahre ?? [2024, 2025, 2026];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-green-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
            Mehrjahres-Trend {jahre[0]}–{jahre[jahre.length - 1]}
          </span>
          {(data?.alert_count ?? 0) > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 rounded-full px-2 py-0.5">
              <AlertTriangle size={10} /> {data?.alert_count} Alert
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {/* Alert-Banner */}
          {alerts.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2">
              <AlertTriangle size={14} />
              {alerts.map(f => f.fahrer_name).join(', ')} — Negativer Mehrjahrestrend!
            </div>
          )}

          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium mb-0.5">Team-Ø {jahre[2]}</div>
              <div className={`font-bold text-base ${teamAkt >= 60 ? 'text-green-600' : teamAkt >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{teamAkt.toFixed(1)} %</div>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium mb-0.5">Team-Ø {jahre[1]}</div>
              <div className="font-bold text-base text-gray-700 dark:text-gray-200">{teamVj.toFixed(1)} %</div>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium mb-0.5">Team-Ø {jahre[0]}</div>
              <div className="font-bold text-base text-gray-700 dark:text-gray-200">{teamVvj.toFixed(1)} %</div>
            </div>
          </div>

          {/* Fahrerliste */}
          <div className="space-y-2">
            {list.map(f => {
              const cls = ampelCls(f.ampel);
              return (
                <div key={f.fahrer_id} className={`rounded-lg border p-3 ${cls.bg}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${cls.dot}`} />
                      <span className={`font-semibold text-sm ${cls.text}`}>{f.fahrer_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`font-bold text-sm ${cls.text}`}>{f.aktuell_pct.toFixed(1)} %</span>
                      <TrendIcon trend={f.trend} />
                      <span className="text-xs text-gray-500">{f.trend_delta > 0 ? '+' : ''}{f.trend_delta.toFixed(1)}</span>
                    </div>
                  </div>
                  <SparklineBars pcts={f.jahre_pct.slice(0, 3)} jahre={jahre} />
                  {f.alert_negativ && (
                    <div className="mt-1.5 text-xs text-red-600 font-semibold flex items-center gap-1">
                      <AlertTriangle size={10} /> Negativer Mehrjahrestrend!
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
