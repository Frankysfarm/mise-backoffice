'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Route } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  effizienz_pct: number;
  effizienz_pct_vw: number | null;
  direkt_km: number;
  ist_km: number;
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
  if (pct >= 80) return { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700', bar: 'bg-green-500' };
  if (pct >= 60) return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' };
  return              { bg: 'bg-red-50 border-red-200',     dot: 'bg-red-500',   text: 'text-red-700',   bar: 'bg-red-500'   };
}

function EffBar({ pct }: { pct: number }) {
  const cls = effClass(pct);
  return (
    <div className="relative h-1.5 rounded-full bg-gray-200 w-20">
      <div className={`absolute left-0 top-0 h-full rounded-full ${cls.bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
      <div className="absolute top-0 h-full border-l-2 border-dashed border-red-400"  style={{ left: '60%' }} title="Alert <60%" />
      <div className="absolute top-0 h-full border-l border-dashed border-green-500"  style={{ left: '80%' }} title="Ziel ≥80%" />
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
    { fahrer_id: 'f5', fahrer_name: 'Jana F.',   effizienz_pct: 48.3, effizienz_pct_vw: 52.0, direkt_km: 2.2, ist_km: 4.6, trend: 'fallend',  trend_delta: -3.7, ampel: 'rot',   alert: true  },
    { fahrer_id: 'f2', fahrer_name: 'Sarah K.',  effizienz_pct: 54.7, effizienz_pct_vw: 59.0, direkt_km: 2.6, ist_km: 4.8, trend: 'fallend',  trend_delta: -4.3, ampel: 'rot',   alert: true  },
    { fahrer_id: 'f3', fahrer_name: 'Lena S.',   effizienz_pct: 68.9, effizienz_pct_vw: 67.0, direkt_km: 3.1, ist_km: 4.5, trend: 'steigend', trend_delta:  1.9, ampel: 'gelb',  alert: false },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',    effizienz_pct: 85.2, effizienz_pct_vw: 82.0, direkt_km: 3.4, ist_km: 4.0, trend: 'steigend', trend_delta:  3.2, ampel: 'gruen', alert: false },
    { fahrer_id: 'f4', fahrer_name: 'Tom B.',    effizienz_pct: 91.0, effizienz_pct_vw: 88.5, direkt_km: 4.1, ist_km: 4.5, trend: 'steigend', trend_delta:  2.5, ampel: 'gruen', alert: false },
  ],
  team_avg_pct: 69.6,
  team_avg_pct_vw: 69.7,
  alert_count: 2,
};

export function DispatchPhase2565RoutenEffizienzBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-routen-effizienz?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted = [...data.fahrer].sort((a, b) => a.effizienz_pct - b.effizienz_pct);
  const hasAlert = data.alert_count > 0;
  const teamCls  = effClass(data.team_avg_pct);
  const alertFahrer = data.fahrer.filter(f => f.alert).map(f => f.fahrer_name);
  const trendDelta = data.team_avg_pct_vw != null ? data.team_avg_pct - data.team_avg_pct_vw : null;

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Route size={16} className={hasAlert ? 'text-red-500' : 'text-blue-600'} />
          <span className="font-semibold text-sm text-gray-800">Routen-Effizienz</span>
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
              <div className="text-lg font-bold text-gray-500">
                {data.team_avg_pct_vw != null ? `${data.team_avg_pct_vw}%` : '–'}
              </div>
              <div className="text-xs text-gray-500">Vorwoche</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-lg font-bold text-green-600">≥80%</div>
              <div className="text-xs text-gray-500">Ziel</div>
            </div>
          </div>

          {/* Trend */}
          {trendDelta !== null && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              {trendDelta >= 0
                ? <TrendingUp size={13} className="text-green-600" />
                : <TrendingDown size={13} className="text-red-500" />}
              <span>
                {trendDelta >= 0 ? '+' : ''}{trendDelta.toFixed(1)}% vs. Vorwoche
              </span>
            </div>
          )}

          {/* Alert */}
          {hasAlert && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
              <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-700 font-medium">
                Routen-Effizienz &lt;60%: {alertFahrer.join(', ')} — Route optimieren!
              </p>
            </div>
          )}

          {/* Fahrerliste */}
          <div className="space-y-2">
            {sorted.map(f => {
              const cls = effClass(f.effizienz_pct);
              return (
                <div key={f.fahrer_id} className={`flex items-center gap-3 rounded-lg border ${cls.bg} px-3 py-2`}>
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cls.dot}`} />
                  <span className="text-sm font-medium text-gray-800 w-20 truncate">{f.fahrer_name}</span>
                  <EffBar pct={f.effizienz_pct} />
                  <span className={`text-xs font-bold w-12 text-right ${cls.text}`}>{f.effizienz_pct}%</span>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <TrendIcon trend={f.trend} />
                    <span>{f.trend_delta >= 0 ? '+' : ''}{f.trend_delta.toFixed(1)}%</span>
                  </div>
                  <span className="text-xs text-gray-400 ml-auto">{f.direkt_km}/{f.ist_km} km</span>
                </div>
              );
            })}
          </div>

          {/* Legende */}
          <div className="flex items-center gap-4 text-xs text-gray-500 pt-1">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /><span>&lt;60% Alert</span></div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400" /><span>60–79% OK</span></div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /><span>≥80% Ziel</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
