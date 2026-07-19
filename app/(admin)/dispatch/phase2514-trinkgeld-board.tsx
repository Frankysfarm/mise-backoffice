'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Gift } from 'lucide-react';

interface FahrerTrinkgeld {
  id: string;
  name: string;
  trinkgeld_gesamt: number;
  trinkgeld_avg: number;
  trinkgeld_avg_vw: number;
  touren: number;
  trend: 'up' | 'down' | 'neutral';
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerTrinkgeld[];
  team_avg: number;
  team_avg_vw: number;
  alert_count: number;
}

function ampelClass(avg: number) {
  if (avg >= 0.75) return { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700' };
  if (avg >= 0.50) return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700' };
  return { bg: 'bg-red-50 border-red-200', dot: 'bg-red-500', text: 'text-red-700' };
}

function TrinkgeldBar({ avg }: { avg: number }) {
  const max = 2.0;
  const w = Math.min(100, (avg / max) * 100);
  const color = avg >= 0.75 ? 'bg-green-500' : avg >= 0.50 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="relative h-1.5 rounded-full bg-gray-200 w-24">
      <div className={`absolute left-0 top-0 h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
      <div className="absolute top-0 h-full border-l border-dashed border-red-400" style={{ left: '25%' }} title="Alert <0,50€" />
      <div className="absolute top-0 h-full border-l-2 border-dashed border-green-600" style={{ left: '37.5%' }} title="Ziel ≥0,75€" />
    </div>
  );
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'neutral' }) {
  if (trend === 'up')   return <TrendingUp size={12} className="text-green-600" />;
  if (trend === 'down') return <TrendingDown size={12} className="text-red-500" />;
  return <Minus size={12} className="text-gray-400" />;
}

const MOCK: ApiData = {
  fahrer: [
    { id: 'd2', name: 'Ben T.',   trinkgeld_gesamt: 9.24,  trinkgeld_avg: 0.42, trinkgeld_avg_vw: 0.55, touren: 22, trend: 'down',    ampel: 'rot',   alert: true },
    { id: 'd3', name: 'Chris M.', trinkgeld_gesamt: 7.50,  trinkgeld_avg: 0.50, trinkgeld_avg_vw: 0.48, touren: 15, trend: 'neutral', ampel: 'gelb',  alert: false },
    { id: 'd4', name: 'Diana P.', trinkgeld_gesamt: 16.00, trinkgeld_avg: 0.80, trinkgeld_avg_vw: 0.72, touren: 20, trend: 'up',     ampel: 'gruen', alert: false },
    { id: 'd1', name: 'Anna K.',  trinkgeld_gesamt: 18.54, trinkgeld_avg: 1.03, trinkgeld_avg_vw: 0.85, touren: 18, trend: 'up',     ampel: 'gruen', alert: false },
  ],
  team_avg: 0.69,
  team_avg_vw: 0.65,
  alert_count: 1,
};

export function DispatchPhase2514TrinkgeldBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-trinkgeld?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted = [...data.fahrer].sort((a, b) => a.trinkgeld_avg - b.trinkgeld_avg);
  const hasAlert = data.alert_count > 0;
  const teamCls = ampelClass(data.team_avg);
  const alertFahrer = data.fahrer.filter(f => f.alert).map(f => f.name);
  const trendTeam = data.team_avg > data.team_avg_vw + 0.02 ? 'up' : data.team_avg < data.team_avg_vw - 0.02 ? 'down' : 'neutral';

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Gift size={16} className={hasAlert ? 'text-red-600' : 'text-amber-500'} />
          <span className="text-sm font-bold text-gray-800">Trinkgeld-Board</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${teamCls.text} ${teamCls.bg}`}>
            Ø {data.team_avg.toFixed(2)}€/Tour
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
              <div className={`text-lg font-black tabular-nums ${teamCls.text}`}>{data.team_avg.toFixed(2)}€</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-2 text-center">
              <div className="text-[10px] text-gray-500 font-medium">Vorwoche</div>
              <div className="flex items-center justify-center gap-1">
                <span className="text-lg font-black tabular-nums text-gray-700">{data.team_avg_vw.toFixed(2)}€</span>
                <TrendIcon trend={trendTeam} />
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 p-2 text-center">
              <div className="text-[10px] text-gray-500 font-medium">Ziel ≥0,75€</div>
              <div className={`text-lg font-black tabular-nums ${data.alert_count > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {data.alert_count} Alert
              </div>
            </div>
          </div>

          {/* Alert Banner */}
          {alertFahrer.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-100 border border-red-200 px-3 py-2 text-xs font-semibold text-red-800">
              <AlertTriangle size={13} className="shrink-0" />
              Trinkgeld &lt;0,50€: {alertFahrer.join(', ')} — Servicequalität prüfen!
            </div>
          )}

          {/* Driver List */}
          <div className="space-y-2">
            {sorted.map(f => {
              const cls = ampelClass(f.trinkgeld_avg);
              return (
                <div key={f.id} className={`rounded-lg border p-2 ${cls.bg}`}>
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${cls.dot}`} />
                    <span className="text-xs font-semibold text-gray-800 flex-1 truncate">{f.name}</span>
                    <span className={`text-xs font-black tabular-nums shrink-0 ${cls.text}`}>{f.trinkgeld_avg.toFixed(2)}€/Tour</span>
                    <TrendIcon trend={f.trend} />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <TrinkgeldBar avg={f.trinkgeld_avg} />
                    <span className="text-[9px] text-gray-400 shrink-0">
                      Gesamt {f.trinkgeld_gesamt.toFixed(2)}€ · {f.touren} Tour{f.touren !== 1 ? 'en' : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-[9px] text-gray-400">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-500" /> &lt;0,50€</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> 0,50–0,74€</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-green-500" /> ≥0,75€</span>
            <span className="ml-auto">30-Min-Polling</span>
          </div>
        </div>
      )}
    </div>
  );
}
