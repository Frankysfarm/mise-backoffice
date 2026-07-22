'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  auslastung_pct: number;
  trend: string;
  trend_delta: number;
  ampel: string;
  alert_gering: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_pct: number;
  alert_count: number;
  quartal: number;
}

const ZIEL_PCT  = 65;
const ALERT_PCT = 45;

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

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', auslastung_pct: 79.3, trend: 'steigend', trend_delta:  3.8, ampel: 'gruen', alert_gering: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   auslastung_pct: 68.4, trend: 'stabil',   trend_delta:  0.2, ampel: 'gruen', alert_gering: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  auslastung_pct: 57.9, trend: 'fallend',  trend_delta: -2.4, ampel: 'gelb',  alert_gering: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   auslastung_pct: 41.2, trend: 'fallend',  trend_delta: -5.3, ampel: 'rot',   alert_gering: true  },
  ],
  team_avg_pct: 61.7,
  alert_count: 1,
  quartal: 3,
};

export function DispatchPhase3061QuartalauslastungBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-quartalauslastung?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  const list    = data?.fahrer ?? [];
  const teamPct = data?.team_avg_pct ?? 0;
  const best    = list[0];
  const alerts  = list.filter(f => f.alert_gering);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-amber-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
            Quartalauslastung {data?.quartal ? `Q${data.quartal}` : ''}
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
              {alerts.map(f => f.fahrer_name).join(', ')} — Geringe Quartalauslastung!
            </div>
          )}

          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium mb-0.5">Team-Ø</div>
              <div className={`font-bold text-base ${teamPct >= ZIEL_PCT ? 'text-green-600' : teamPct >= ALERT_PCT ? 'text-amber-600' : 'text-red-600'}`}>{teamPct.toFixed(1)} %</div>
            </div>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium mb-0.5">Bester</div>
              <div className="font-bold text-base text-green-600">{best ? `${best.auslastung_pct.toFixed(1)} %` : '—'}</div>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium mb-0.5">Ziel</div>
              <div className="font-bold text-base text-gray-700 dark:text-gray-200">≥ {ZIEL_PCT} %</div>
            </div>
          </div>

          {/* Fahrerliste */}
          <div className="space-y-2">
            {list.map(f => {
              const cls = ampelCls(f.ampel);
              const barW = Math.min(100, f.auslastung_pct);
              return (
                <div key={f.fahrer_id} className={`rounded-lg border p-3 ${cls.bg}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${cls.dot}`} />
                      <span className={`font-semibold text-sm ${cls.text}`}>{f.fahrer_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`font-bold text-sm ${cls.text}`}>{f.auslastung_pct.toFixed(1)} %</span>
                      <TrendIcon trend={f.trend} />
                      <span className="text-xs text-gray-500">{f.trend_delta > 0 ? '+' : ''}{f.trend_delta.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${cls.bar}`} style={{ width: `${barW}%` }} />
                    <div className="absolute top-0 bottom-0 w-0.5 bg-gray-700 dark:bg-gray-200 opacity-60" style={{ left: `${ZIEL_PCT}%` }} />
                  </div>
                  {f.alert_gering && (
                    <div className="mt-1.5 text-xs text-red-600 font-semibold flex items-center gap-1">
                      <AlertTriangle size={10} /> Geringe Quartalauslastung!
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
