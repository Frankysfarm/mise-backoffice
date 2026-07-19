'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Map } from 'lucide-react';

interface FahrerTouren {
  fahrer_id: string;
  fahrer_name: string;
  touren_heute: number;
  touren_vw: number;
  trend: string;
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_low: boolean;
  alert_high: boolean;
  rang: number;
}

interface ApiData {
  fahrer: FahrerTouren[];
  team_avg_touren: number;
  team_avg_touren_vw: number;
  alert_count: number;
}

function ampelClass(touren: number) {
  if (touren >= 6 && touren <= 10) return { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700' };
  if (touren < 4 || touren > 12) return { bg: 'bg-red-50 border-red-200', dot: 'bg-red-500', text: 'text-red-700' };
  return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700' };
}

function TourenBar({ touren }: { touren: number }) {
  const max = 15;
  const w = Math.min(100, (touren / max) * 100);
  const color = touren >= 6 && touren <= 10 ? 'bg-green-500' : touren < 4 || touren > 12 ? 'bg-red-500' : 'bg-amber-400';
  return (
    <div className="relative h-1.5 rounded-full bg-gray-200 w-24">
      <div className={`absolute left-0 top-0 h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
      <div className="absolute top-0 h-full border-l border-dashed border-green-500" style={{ left: `${(6 / max) * 100}%` }} title="Min 6" />
      <div className="absolute top-0 h-full border-l border-dashed border-green-500" style={{ left: `${(10 / max) * 100}%` }} title="Max 10" />
      <div className="absolute top-0 h-full border-l border-dashed border-red-400" style={{ left: `${(12 / max) * 100}%` }} title="Alert 12" />
    </div>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp size={12} className="text-green-600" />;
  if (trend === 'fallend') return <TrendingDown size={12} className="text-red-500" />;
  return <Minus size={12} className="text-gray-400" />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'd1', fahrer_name: 'Max M.',   touren_heute: 9,  touren_vw: 8,  trend: 'steigend', trend_delta: 1,  ampel: 'gruen', alert_low: false, alert_high: false, rang: 1 },
    { fahrer_id: 'd2', fahrer_name: 'Sara K.',  touren_heute: 3,  touren_vw: 7,  trend: 'fallend',  trend_delta: -4, ampel: 'rot',   alert_low: true,  alert_high: false, rang: 4 },
    { fahrer_id: 'd3', fahrer_name: 'Tim B.',   touren_heute: 13, touren_vw: 11, trend: 'steigend', trend_delta: 2,  ampel: 'rot',   alert_low: false, alert_high: true,  rang: 2 },
    { fahrer_id: 'd4', fahrer_name: 'Julia F.', touren_heute: 7,  touren_vw: 6,  trend: 'steigend', trend_delta: 1,  ampel: 'gruen', alert_low: false, alert_high: false, rang: 3 },
  ],
  team_avg_touren: 8.0,
  team_avg_touren_vw: 8.0,
  alert_count: 2,
};

export function DispatchPhase2488TourenAnzahlBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-touren-anzahl?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted = [...data.fahrer].sort((a, b) => b.touren_heute - a.touren_heute);
  const hasAlert = data.alert_count > 0;
  const teamAvg = data.team_avg_touren;
  const teamCls = ampelClass(teamAvg);
  const alertLow = data.fahrer.filter(f => f.alert_low).map(f => f.fahrer_name);
  const alertHigh = data.fahrer.filter(f => f.alert_high).map(f => f.fahrer_name);

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Map size={16} className={hasAlert ? 'text-red-600' : 'text-blue-600'} />
          <span className="text-sm font-bold text-gray-800">Touren-Anzahl Board</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${teamCls.text} ${teamCls.bg}`}>
            Ø {teamAvg.toFixed(1)} Touren
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
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Team-Ø Touren', val: `${teamAvg.toFixed(1)}`, col: teamCls.text },
              { label: 'Ziel', val: '6–10',  col: 'text-green-700' },
              { label: 'Alerts', val: `${data.alert_count}`, col: hasAlert ? 'text-red-700' : 'text-gray-500' },
            ].map(k => (
              <div key={k.label} className="rounded-lg bg-gray-50 px-2 py-2 text-center">
                <div className={`text-base font-black ${k.col}`}>{k.val}</div>
                <div className="text-[9px] text-gray-500 mt-0.5">{k.label}</div>
              </div>
            ))}
          </div>

          {alertLow.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-100 px-3 py-2 text-xs font-semibold text-red-800">
              <AlertTriangle size={14} className="shrink-0" />
              Zu wenige Touren (&lt;4): {alertLow.join(', ')} — Kapazität prüfen!
            </div>
          )}
          {alertHigh.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-100 px-3 py-2 text-xs font-semibold text-red-800">
              <AlertTriangle size={14} className="shrink-0" />
              Überlastet (&gt;12): {alertHigh.join(', ')} — Fahrer entlasten!
            </div>
          )}

          <div className="space-y-1.5">
            {sorted.map(f => {
              const cls = ampelClass(f.touren_heute);
              return (
                <div key={f.fahrer_id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${cls.bg}`}>
                  <span className={`h-2 w-2 rounded-full shrink-0 ${cls.dot}`} />
                  <span className="text-xs font-semibold text-gray-800 w-20 truncate">{f.fahrer_name}</span>
                  <TourenBar touren={f.touren_heute} />
                  <span className={`text-xs font-black w-10 text-right tabular-nums ${cls.text}`}>
                    {f.touren_heute}
                  </span>
                  <TrendIcon trend={f.trend} />
                  <span className="text-[10px] text-gray-400 w-10 text-right">
                    {f.trend_delta > 0 ? '+' : ''}{f.trend_delta} VW
                  </span>
                  {(f.alert_low || f.alert_high) && <AlertTriangle size={11} className="text-red-500 shrink-0" />}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 text-[9px] text-gray-400">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500 inline-block" />6–10 Touren</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />4–5 / 11–12</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" />&lt;4 / &gt;12</span>
            <span className="ml-auto">30-Min-Polling · Ziel: 6–10 Touren</span>
          </div>
        </div>
      )}
    </div>
  );
}
