'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, XCircle } from 'lucide-react';

interface SparkDay { datum: string; storno_quote_pct: number }

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  storno_quote_heute: number;
  storno_quote_gestern: number | null;
  storno_quote_vw: number | null;
  sparkline: SparkDay[];
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_heute: number;
  team_avg_gestern: number | null;
  alert_count: number;
}

function ampelCls(ampel: string) {
  if (ampel === 'rot')  return { bg: 'bg-red-50 border-red-200', dot: 'bg-red-500', text: 'text-red-700' };
  if (ampel === 'gelb') return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700' };
  return { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700' };
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp size={12} className="text-red-500" />;
  if (trend === 'fallend')  return <TrendingDown size={12} className="text-green-600" />;
  return <Minus size={12} className="text-gray-400" />;
}

function Sparkline({ data }: { data: SparkDay[] }) {
  if (!data.length) return <div className="w-16 h-8 bg-gray-100 rounded" />;
  const vals = data.map(d => d.storno_quote_pct);
  const min  = Math.min(...vals);
  const max  = Math.max(...vals, 5); // at least 5% scale
  const range = max - min || 1;
  const W = 64; const H = 24; const n = vals.length;
  const pts = vals.map((v, i) => {
    const x = (i / (n - 1)) * (W - 2) + 1;
    const y = H - 2 - ((v - min) / range) * (H - 4);
    return `${x},${y}`;
  }).join(' ');
  const lastVal = vals[vals.length - 1];
  const color   = lastVal > 15 ? '#ef4444' : lastVal > 5 ? '#f59e0b' : '#22c55e';
  return (
    <svg width={W} height={H} className="flex-shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f2', fahrer_name: 'Jana F.',   storno_quote_heute: 21.4, storno_quote_gestern: 19.0, storno_quote_vw: 18.0,
      sparkline: [15.0,16.0,17.5,18.2,18.9,19.0,21.4].map((v,i)=>({ datum:`07-${13+i}`, storno_quote_pct:v })),
      trend:'steigend', trend_delta:2.4, ampel:'rot', alert:true },
    { fahrer_id: 'f3', fahrer_name: 'Sarah K.',  storno_quote_heute: 18.5, storno_quote_gestern: 15.2, storno_quote_vw: 12.0,
      sparkline: [10.0,11.5,13.0,14.2,14.8,15.2,18.5].map((v,i)=>({ datum:`07-${13+i}`, storno_quote_pct:v })),
      trend:'steigend', trend_delta:3.3, ampel:'rot', alert:true },
    { fahrer_id: 'f4', fahrer_name: 'Lena S.',   storno_quote_heute:  8.7, storno_quote_gestern:  9.5, storno_quote_vw: 7.5,
      sparkline: [7.0,7.5,8.0,9.0,9.8,9.5,8.7].map((v,i)=>({ datum:`07-${13+i}`, storno_quote_pct:v })),
      trend:'fallend', trend_delta:-0.8, ampel:'gelb', alert:false },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',    storno_quote_heute:  3.2, storno_quote_gestern:  4.1, storno_quote_vw: 4.0,
      sparkline: [5.0,4.5,4.8,3.9,3.5,4.1,3.2].map((v,i)=>({ datum:`07-${13+i}`, storno_quote_pct:v })),
      trend:'fallend', trend_delta:-0.9, ampel:'gruen', alert:false },
    { fahrer_id: 'f5', fahrer_name: 'Tom B.',    storno_quote_heute:  2.1, storno_quote_gestern:  2.5, storno_quote_vw: 3.0,
      sparkline: [3.5,3.0,2.8,2.5,2.3,2.5,2.1].map((v,i)=>({ datum:`07-${13+i}`, storno_quote_pct:v })),
      trend:'fallend', trend_delta:-0.4, ampel:'gruen', alert:false },
  ],
  team_avg_heute: 10.8, team_avg_gestern: 10.1, alert_count: 2,
};

export function DispatchPhase2580StornoQuoteTrendBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-storno-quote-trend?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted     = [...data.fahrer].sort((a, b) => b.storno_quote_heute - a.storno_quote_heute);
  const hasAlert   = data.alert_count > 0;
  const teamCls    = ampelCls(data.team_avg_heute > 15 ? 'rot' : data.team_avg_heute > 5 ? 'gelb' : 'gruen');
  const alertNames = data.fahrer.filter((f: FahrerEntry) => f.alert).map((f: FahrerEntry) => f.fahrer_name);

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <XCircle size={16} className={hasAlert ? 'text-red-500' : 'text-green-600'} />
          <span className="font-semibold text-sm text-gray-800">Storno-Quote-Trend-Board</span>
          {hasAlert && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              {data.alert_count} Alert{data.alert_count > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold ${teamCls.text}`}>Ø {data.team_avg_heute.toFixed(1)}%</span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className={`text-lg font-bold ${teamCls.text}`}>{data.team_avg_heute.toFixed(1)}%</div>
              <div className="text-xs text-gray-500">Team Ø heute</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-lg font-bold text-gray-700">
                {data.team_avg_gestern !== null ? `${data.team_avg_gestern.toFixed(1)}%` : '—'}
              </div>
              <div className="text-xs text-gray-500">Gestern</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-lg font-bold text-green-600">≤5%</div>
              <div className="text-xs text-gray-500">Ziel</div>
            </div>
          </div>

          {/* Alert-Banner */}
          {hasAlert && (
            <div className="flex items-center gap-2 bg-red-100 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="text-red-600 flex-shrink-0" />
              <p className="text-xs text-red-700 font-medium">
                Storno-Quote &gt;15%: {alertNames.join(', ')}
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
                  <Sparkline data={f.sparkline} />
                  <span className={`text-xs font-bold w-10 text-right ${cls.text}`}>{f.storno_quote_heute.toFixed(1)}%</span>
                  <TrendIcon trend={f.trend} />
                  <span className="text-xs text-gray-400 w-10 text-right">
                    {f.trend_delta > 0 ? '+' : ''}{f.trend_delta.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>

          {/* Legende */}
          <div className="flex gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />≤5%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />6–15%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />&gt;15%</span>
          </div>
        </div>
      )}
    </div>
  );
}
