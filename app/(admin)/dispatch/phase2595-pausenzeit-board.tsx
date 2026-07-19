'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_pause_min: number;
  avg_pause_min_vw: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_lang: boolean;
  alert_kurz: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_pause_min: number;
  team_avg_pause_min_vw: number;
  alert_count: number;
}

function ampelCls(ampel: string) {
  if (ampel === 'rot')  return { bg: 'bg-red-50 border-red-200', dot: 'bg-red-500', text: 'text-red-700', bar: 'bg-red-500' };
  if (ampel === 'gelb') return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' };
  return { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700', bar: 'bg-green-500' };
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp size={12} className="text-red-500" />;
  if (trend === 'fallend')  return <TrendingDown size={12} className="text-green-600" />;
  return <Minus size={12} className="text-gray-400" />;
}

function PausenzeitBalken({ min, barClass }: { min: number; barClass: string }) {
  const MAX = 60;
  const ZIEL = 15;
  const fill    = Math.min(100, (min / MAX) * 100);
  const goalPct = Math.min(100, (ZIEL / MAX) * 100);
  return (
    <div className="relative h-3 rounded-full bg-gray-200 flex-1">
      <div className={`absolute top-0 left-0 h-full rounded-full ${barClass}`} style={{ width: `${fill}%` }} />
      <div
        className="absolute top-0 h-full border-l-2 border-dashed border-green-500"
        style={{ left: `${goalPct}%` }}
        title="Ziel ≤15 Min"
      />
    </div>
  );
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   avg_pause_min: 38.1, avg_pause_min_vw: 29.4, trend: 'steigend', trend_delta: 8.7,  ampel: 'rot',   alert_lang: true,  alert_kurz: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  avg_pause_min: 24.3, avg_pause_min_vw: 18.7, trend: 'steigend', trend_delta: 5.6,  ampel: 'gelb',  alert_lang: false, alert_kurz: false },
    { fahrer_id: 'f5', fahrer_name: 'Jonas W.', avg_pause_min: 17.8, avg_pause_min_vw: 19.2, trend: 'stabil',   trend_delta: -1.4, ampel: 'gruen', alert_lang: false, alert_kurz: false },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   avg_pause_min: 12.5, avg_pause_min_vw: 11.0, trend: 'stabil',   trend_delta: 1.5,  ampel: 'gruen', alert_lang: false, alert_kurz: false },
    { fahrer_id: 'f4', fahrer_name: 'Lisa F.',  avg_pause_min: 3.2,  avg_pause_min_vw: 7.1,  trend: 'fallend',  trend_delta: -3.9, ampel: 'rot',   alert_lang: false, alert_kurz: true  },
  ],
  team_avg_pause_min: 19.2, team_avg_pause_min_vw: 17.1, alert_count: 2,
};

export function DispatchPhase2595PausenzeitBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-pausenzeit?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted     = [...data.fahrer].sort((a, b) => b.avg_pause_min - a.avg_pause_min);
  const hasAlert   = data.alert_count > 0;
  const teamAmpel  = data.team_avg_pause_min <= 15 ? 'gruen' : data.team_avg_pause_min <= 30 ? 'gelb' : 'rot';
  const teamCls    = ampelCls(teamAmpel);
  const alertNames = data.fahrer.filter((f: FahrerEntry) => f.alert_lang).map((f: FahrerEntry) => f.fahrer_name);

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className={hasAlert ? 'text-red-500' : 'text-green-600'} />
          <span className="font-semibold text-sm text-gray-800">Pausenzeit-Board</span>
          {hasAlert && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              {data.alert_count} Alert{data.alert_count > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold ${teamCls.text}`}>Ø {data.team_avg_pause_min.toFixed(1)} Min</span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className={`text-lg font-bold ${teamCls.text}`}>{data.team_avg_pause_min.toFixed(1)}'</div>
              <div className="text-xs text-gray-500">Team Ø heute</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-lg font-bold text-gray-700">{data.team_avg_pause_min_vw.toFixed(1)}'</div>
              <div className="text-xs text-gray-500">Vorwoche</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-lg font-bold text-green-600">≤15'</div>
              <div className="text-xs text-gray-500">Ziel</div>
            </div>
          </div>

          {/* Alert-Banner */}
          {alertNames.length > 0 && (
            <div className="flex items-center gap-2 bg-red-100 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="text-red-600 flex-shrink-0" />
              <p className="text-xs text-red-700 font-medium">
                Langer Stillstand (&gt;30 Min): {alertNames.join(', ')}
              </p>
            </div>
          )}

          {/* Fahrerliste */}
          <div className="space-y-1.5">
            {sorted.map(f => {
              const cls = ampelCls(f.ampel);
              return (
                <div key={f.fahrer_id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${cls.bg}`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cls.dot}`} />
                  <span className="text-xs font-medium text-gray-700 w-20 truncate">{f.fahrer_name}</span>
                  <PausenzeitBalken min={f.avg_pause_min} barClass={cls.bar} />
                  <span className={`text-xs font-bold w-12 text-right ${cls.text}`}>{f.avg_pause_min.toFixed(1)}'</span>
                  <TrendIcon trend={f.trend} />
                  <span className="text-xs text-gray-400 w-10 text-right">
                    {f.trend_delta > 0 ? '+' : ''}{f.trend_delta.toFixed(1)}'
                  </span>
                </div>
              );
            })}
          </div>

          {/* Legende */}
          <div className="flex gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />≤15 Min</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />15–30 Min</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />&gt;30 Min</span>
          </div>
        </div>
      )}
    </div>
  );
}
