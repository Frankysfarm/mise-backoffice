'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  effizienz_pct: number;
  online_min: number;
  liefer_min: number;
  effizienz_pct_vw: number | null;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_pct: number;
  team_avg_pct_vw: number | null;
  alert_count: number;
}

function effClass(pct: number) {
  if (pct >= 60) return { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700', bar: 'bg-green-500' };
  if (pct >= 40) return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' };
  return              { bg: 'bg-red-50 border-red-200',     dot: 'bg-red-500',   text: 'text-red-700',   bar: 'bg-red-500'   };
}

function EffBar({ pct }: { pct: number }) {
  const cls = effClass(pct);
  return (
    <div className="relative h-1.5 rounded-full bg-gray-200 w-20">
      <div className={`absolute left-0 top-0 h-full rounded-full ${cls.bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
      <div className="absolute top-0 h-full border-l-2 border-dashed border-red-400"  style={{ left: '40%' }} title="Alert <40%" />
      <div className="absolute top-0 h-full border-l border-dashed border-green-500"  style={{ left: '60%' }} title="Ziel ≥60%" />
    </div>
  );
}

function TrendIcon({ trend }: { trend: 'steigend' | 'fallend' | 'stabil' }) {
  if (trend === 'steigend') return <TrendingUp  size={12} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={12} className="text-red-500"  />;
  return <Minus size={12} className="text-gray-400" />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f5', fahrer_name: 'Jana F.',  effizienz_pct: 31, online_min: 360, liefer_min: 112, effizienz_pct_vw: 35, trend: 'fallend',  trend_delta: -4, ampel: 'rot',   alert: true  },
    { fahrer_id: 'f3', fahrer_name: 'Lena S.',  effizienz_pct: 38, online_min: 390, liefer_min: 148, effizienz_pct_vw: 42, trend: 'fallend',  trend_delta: -4, ampel: 'rot',   alert: true  },
    { fahrer_id: 'f2', fahrer_name: 'Sarah K.', effizienz_pct: 55, online_min: 420, liefer_min: 231, effizienz_pct_vw: 60, trend: 'fallend',  trend_delta: -5, ampel: 'gelb',  alert: false },
    { fahrer_id: 'f4', fahrer_name: 'Tom B.',   effizienz_pct: 64, online_min: 450, liefer_min: 288, effizienz_pct_vw: 61, trend: 'steigend', trend_delta:  3, ampel: 'gruen', alert: false },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   effizienz_pct: 72, online_min: 480, liefer_min: 346, effizienz_pct_vw: 68, trend: 'steigend', trend_delta:  4, ampel: 'gruen', alert: false },
  ],
  team_avg_pct: 52,
  team_avg_pct_vw: 53,
  alert_count: 2,
};

export function DispatchPhase2560OnlineZeitEffizienzBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-online-zeit?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted = [...data.fahrer].sort((a, b) => a.effizienz_pct - b.effizienz_pct);
  const hasAlert = data.alert_count > 0;
  const teamCls = effClass(data.team_avg_pct);
  const alertFahrer = data.fahrer.filter(f => f.alert).map(f => f.fahrer_name);
  const trendDelta = data.team_avg_pct_vw != null ? data.team_avg_pct - data.team_avg_pct_vw : null;

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className={hasAlert ? 'text-red-500' : 'text-blue-600'} />
          <span className="font-semibold text-sm text-gray-800">Online-Zeit-Effizienz</span>
          {hasAlert && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              {data.alert_count} Alert{data.alert_count > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold ${teamCls.text}`}>Ø {data.team_avg_pct}%</span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className={`text-lg font-bold ${teamCls.text}`}>{data.team_avg_pct}%</div>
              <div className="text-xs text-gray-500">Team Ø heute</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-lg font-bold text-gray-500">{data.team_avg_pct_vw != null ? `${data.team_avg_pct_vw}%` : '–'}</div>
              <div className="text-xs text-gray-500">Vorwoche</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-lg font-bold text-green-600">≥60%</div>
              <div className="text-xs text-gray-500">Ziel</div>
            </div>
          </div>

          {/* Trend */}
          {trendDelta !== null && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              {trendDelta > 0
                ? <TrendingUp size={12} className="text-green-600" />
                : trendDelta < 0
                  ? <TrendingDown size={12} className="text-red-500" />
                  : <Minus size={12} className="text-gray-400" />}
              <span>{trendDelta > 0 ? '+' : ''}{trendDelta}% vs. Vorwoche</span>
            </div>
          )}

          {/* Alert-Banner */}
          {hasAlert && (
            <div className="flex items-center gap-2 bg-red-100 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="text-red-600 flex-shrink-0" />
              <p className="text-xs text-red-700 font-medium">
                Effizienz kritisch (&lt;40%): {alertFahrer.join(', ')}
              </p>
            </div>
          )}

          {/* Fahrerliste */}
          <div className="space-y-1.5">
            {sorted.map(f => {
              const cls = effClass(f.effizienz_pct);
              return (
                <div key={f.fahrer_id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${cls.bg}`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cls.dot}`} />
                  <span className="text-xs font-medium text-gray-700 w-20 truncate">{f.fahrer_name}</span>
                  <EffBar pct={f.effizienz_pct} />
                  <span className={`text-xs font-bold w-10 text-right ${cls.text}`}>{f.effizienz_pct}%</span>
                  <TrendIcon trend={f.trend} />
                  <span className="text-xs text-gray-400 w-20 text-right">{f.liefer_min}m/{f.online_min}m</span>
                </div>
              );
            })}
          </div>

          {/* Legende */}
          <div className="flex gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />≥60%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />40–59%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />&lt;40%</span>
          </div>
        </div>
      )}
    </div>
  );
}
