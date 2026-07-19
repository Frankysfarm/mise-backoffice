'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, CheckCircle } from 'lucide-react';

interface FahrerAkzeptanz {
  fahrer_id: string;
  fahrer_name: string;
  akzeptanzrate: number;
  akzeptanzrate_vw: number;
  angenommen: number;
  angeboten: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiData {
  fahrer: FahrerAkzeptanz[];
  team_avg_rate: number;
  team_avg_rate_vw: number;
  alert_count: number;
}

function ampelClass(rate: number) {
  if (rate >= 90) return { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700' };
  if (rate >= 70) return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700' };
  return { bg: 'bg-red-50 border-red-200', dot: 'bg-red-500', text: 'text-red-700' };
}

function AkzeptanzBar({ rate }: { rate: number }) {
  const w = Math.min(100, rate);
  const color = rate >= 90 ? 'bg-green-500' : rate >= 70 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="relative h-1.5 rounded-full bg-gray-200 w-24">
      <div className={`absolute left-0 top-0 h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
      <div className="absolute top-0 h-full border-l border-dashed border-red-400" style={{ left: '70%' }} title="Alert <70%" />
      <div className="absolute top-0 h-full border-l-2 border-dashed border-green-600" style={{ left: '90%' }} title="Ziel ≥90%" />
    </div>
  );
}

function TrendIcon({ trend }: { trend: 'steigend' | 'fallend' | 'stabil' }) {
  if (trend === 'steigend') return <TrendingUp size={12} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={12} className="text-red-500" />;
  return <Minus size={12} className="text-gray-400" />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'd3', fahrer_name: 'Tim B.',   akzeptanzrate: 55.6, akzeptanzrate_vw: 77.8, angenommen: 10, angeboten: 18, trend: 'fallend',  trend_delta: -22.2, ampel: 'rot',   alert_niedrig: true },
    { fahrer_id: 'd2', fahrer_name: 'Sara K.',  akzeptanzrate: 85.0, akzeptanzrate_vw: 84.2, angenommen: 17, angeboten: 20, trend: 'stabil',   trend_delta:   0.8, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'd4', fahrer_name: 'Julia F.', akzeptanzrate: 95.5, akzeptanzrate_vw: 90.5, angenommen: 21, angeboten: 22, trend: 'steigend', trend_delta:   5.0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'd1', fahrer_name: 'Max M.',   akzeptanzrate: 95.7, akzeptanzrate_vw: 87.0, angenommen: 22, angeboten: 23, trend: 'steigend', trend_delta:   8.7, ampel: 'gruen', alert_niedrig: false },
  ],
  team_avg_rate: 82.9,
  team_avg_rate_vw: 84.9,
  alert_count: 1,
};

export function DispatchPhase2525AkzeptanzrateBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-akzeptanzrate?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted = [...data.fahrer].sort((a, b) => a.akzeptanzrate - b.akzeptanzrate);
  const hasAlert = data.alert_count > 0;
  const teamCls = ampelClass(data.team_avg_rate);
  const alertFahrer = data.fahrer.filter(f => f.alert_niedrig).map(f => f.fahrer_name);
  const trendTeam = data.team_avg_rate > data.team_avg_rate_vw + 1 ? 'steigend'
    : data.team_avg_rate < data.team_avg_rate_vw - 1 ? 'fallend' : 'stabil';

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <CheckCircle size={16} className={hasAlert ? 'text-red-600' : 'text-green-600'} />
          <span className="text-sm font-bold text-gray-800">Akzeptanzrate-Board</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${teamCls.text} ${teamCls.bg}`}>
            Ø {data.team_avg_rate.toFixed(1)}%
          </span>
          {hasAlert && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700 animate-pulse">
              <AlertTriangle size={10} /> {data.alert_count} Alert
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-4">
          {/* KPI Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-gray-50 p-2 text-center">
              <div className="text-[10px] text-gray-500 font-medium">Team-Ø heute</div>
              <div className={`text-lg font-black tabular-nums ${teamCls.text}`}>{data.team_avg_rate.toFixed(1)}%</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-2 text-center">
              <div className="text-[10px] text-gray-500 font-medium">Vorwoche</div>
              <div className="flex items-center justify-center gap-1">
                <span className="text-lg font-black tabular-nums text-gray-700">{data.team_avg_rate_vw.toFixed(1)}%</span>
                <TrendIcon trend={trendTeam} />
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 p-2 text-center">
              <div className="text-[10px] text-gray-500 font-medium">Ziel ≥90%</div>
              <div className={`text-lg font-black tabular-nums ${data.alert_count > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {data.alert_count} Alert
              </div>
            </div>
          </div>

          {/* Alert Banner */}
          {alertFahrer.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-100 border border-red-200 px-3 py-2 text-xs font-semibold text-red-800">
              <AlertTriangle size={13} className="shrink-0" />
              Akzeptanzrate &lt;70%: {alertFahrer.join(', ')} — Motivationsgespräch empfohlen!
            </div>
          )}

          {/* Driver List */}
          <div className="space-y-2">
            {sorted.map(f => {
              const cls = ampelClass(f.akzeptanzrate);
              return (
                <div key={f.fahrer_id} className={`rounded-lg border p-2 ${cls.bg}`}>
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${cls.dot}`} />
                    <span className="text-xs font-semibold text-gray-800 flex-1 truncate">{f.fahrer_name}</span>
                    <span className={`text-xs font-black tabular-nums shrink-0 ${cls.text}`}>{f.akzeptanzrate.toFixed(1)}%</span>
                    <TrendIcon trend={f.trend} />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <AkzeptanzBar rate={f.akzeptanzrate} />
                    <span className="text-[9px] text-gray-400 shrink-0">
                      {f.angenommen}/{f.angeboten} angenommen
                      {f.trend_delta !== 0 && ` · VW ${f.trend_delta > 0 ? '+' : ''}${f.trend_delta.toFixed(1)}%`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-[9px] text-gray-400">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-500" /> &lt;70%</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> 70–89%</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-green-500" /> ≥90%</span>
            <span className="ml-auto">30-Min-Polling</span>
          </div>
        </div>
      )}
    </div>
  );
}
