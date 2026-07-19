'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, XCircle } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  storno_rate_pct: number;
  storno_rate_vw: number | null;
  angebotene_touren: number;
  stornierte_touren: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_storno_rate_pct: number;
  alert_count: number;
}

function ampelClass(pct: number) {
  if (pct > 15) return { bg: 'bg-red-50 border-red-200', dot: 'bg-red-500', text: 'text-red-700' };
  if (pct > 5)  return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700' };
  return { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700' };
}

function StornoBar({ pct }: { pct: number }) {
  const maxPct = 30;
  const w = Math.min(100, (pct / maxPct) * 100);
  const color = pct > 15 ? 'bg-red-500' : pct > 5 ? 'bg-amber-400' : 'bg-green-500';
  return (
    <div className="relative h-1.5 rounded-full bg-gray-200 w-24">
      <div className={`absolute left-0 top-0 h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
      <div className="absolute top-0 h-full border-l border-dashed border-amber-400" style={{ left: `${(5 / maxPct) * 100}%` }} title="Ziel ≤5%" />
      <div className="absolute top-0 h-full border-l-2 border-dashed border-red-500" style={{ left: `${(15 / maxPct) * 100}%` }} title="Alert >15%" />
    </div>
  );
}

function TrendIcon({ trend }: { trend: 'steigend' | 'fallend' | 'stabil' }) {
  if (trend === 'steigend') return <TrendingUp size={12} className="text-red-500" />;
  if (trend === 'fallend')  return <TrendingDown size={12} className="text-green-600" />;
  return <Minus size={12} className="text-gray-400" />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f5', fahrer_name: 'Jana F.',   storno_rate_pct: 21.4, storno_rate_vw: 18.0, angebotene_touren: 14, stornierte_touren: 3, trend: 'steigend', trend_delta:  3.4, ampel: 'rot',   alert: true  },
    { fahrer_id: 'f2', fahrer_name: 'Sarah K.',  storno_rate_pct: 18.5, storno_rate_vw: 12.0, angebotene_touren: 27, stornierte_touren: 5, trend: 'steigend', trend_delta:  6.5, ampel: 'rot',   alert: true  },
    { fahrer_id: 'f3', fahrer_name: 'Lena S.',   storno_rate_pct:  8.7, storno_rate_vw:  7.5, angebotene_touren: 23, stornierte_touren: 2, trend: 'steigend', trend_delta:  1.2, ampel: 'gelb',  alert: false },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',    storno_rate_pct:  3.2, storno_rate_vw:  4.0, angebotene_touren: 31, stornierte_touren: 1, trend: 'fallend',  trend_delta: -0.8, ampel: 'gruen', alert: false },
    { fahrer_id: 'f4', fahrer_name: 'Tom B.',    storno_rate_pct:  2.1, storno_rate_vw:  3.0, angebotene_touren: 48, stornierte_touren: 1, trend: 'fallend',  trend_delta: -0.9, ampel: 'gruen', alert: false },
  ],
  team_avg_storno_rate_pct: 10.8,
  alert_count: 2,
};

export function DispatchPhase2540StornoRateBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-storno-rate?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted = [...data.fahrer].sort((a, b) => b.storno_rate_pct - a.storno_rate_pct);
  const hasAlert = data.alert_count > 0;
  const teamCls = ampelClass(data.team_avg_storno_rate_pct);
  const alertFahrer = data.fahrer.filter(f => f.alert).map(f => f.fahrer_name);

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <XCircle size={16} className={hasAlert ? 'text-red-500' : 'text-gray-400'} />
          <span className="font-semibold text-sm text-gray-800">Storno-Rate Fahrer</span>
          {hasAlert && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              {data.alert_count} Alert{data.alert_count > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold ${teamCls.text}`}>
            Ø {data.team_avg_storno_rate_pct.toFixed(1)}%
          </span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className={`text-lg font-bold ${teamCls.text}`}>{data.team_avg_storno_rate_pct.toFixed(1)}%</div>
              <div className="text-xs text-gray-500">Team Ø heute</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-lg font-bold text-gray-700">≤5%</div>
              <div className="text-xs text-gray-500">Ziel</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className={`text-lg font-bold ${hasAlert ? 'text-red-600' : 'text-gray-700'}`}>{data.alert_count}</div>
              <div className="text-xs text-gray-500">Alerts &gt;15%</div>
            </div>
          </div>

          {/* Alert-Banner */}
          {hasAlert && (
            <div className="flex items-center gap-2 bg-red-100 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="text-red-600 flex-shrink-0" />
              <p className="text-xs text-red-700 font-medium">
                Gespräch empfohlen: {alertFahrer.join(', ')}
              </p>
            </div>
          )}

          {/* Fahrerliste */}
          <div className="space-y-1.5">
            {sorted.map(f => {
              const cls = ampelClass(f.storno_rate_pct);
              return (
                <div key={f.fahrer_id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${cls.bg}`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cls.dot}`} />
                  <span className="text-xs font-medium text-gray-700 w-20 truncate">{f.fahrer_name}</span>
                  <StornoBar pct={f.storno_rate_pct} />
                  <span className={`text-xs font-bold w-10 text-right ${cls.text}`}>{f.storno_rate_pct.toFixed(1)}%</span>
                  <TrendIcon trend={f.trend} />
                  <span className="text-xs text-gray-400 w-16 text-right">{f.stornierte_touren}/{f.angebotene_touren} T</span>
                </div>
              );
            })}
          </div>

          {/* Legende */}
          <div className="flex gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />≤5%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />5–15%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />&gt;15%</span>
          </div>
        </div>
      )}
    </div>
  );
}
