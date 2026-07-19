'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Euro } from 'lucide-react';

interface FahrerUmsatz {
  fahrer_id: string;
  fahrer_name: string;
  umsatz_euro: number;
  umsatz_vorwoche: number | null;
  touren_heute: number;
  trend: string;
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rang: number;
}

interface ApiData {
  fahrer: FahrerUmsatz[];
  team_total_euro: number;
  team_avg_euro: number;
  alert_count: number;
}

function ampelClass(euro: number) {
  if (euro >= 200) return { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700' };
  if (euro >= 100) return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700' };
  return { bg: 'bg-red-50 border-red-200', dot: 'bg-red-500', text: 'text-red-700' };
}

function EuroBar({ euro }: { euro: number }) {
  const max = 300;
  const w = Math.min(100, (euro / max) * 100);
  const color = euro >= 200 ? 'bg-green-500' : euro >= 100 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="relative h-1.5 rounded-full bg-gray-200 w-24">
      <div className={`absolute left-0 top-0 h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
      <div className="absolute top-0 h-full border-l border-dashed border-amber-400" style={{ left: '33.3%' }} title="Alert <100€" />
      <div className="absolute top-0 h-full border-l-2 border-dashed border-green-600" style={{ left: '66.7%' }} title="Ziel ≥200€" />
    </div>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp size={12} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={12} className="text-red-500" />;
  return <Minus size={12} className="text-gray-400" />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'mock-f3', fahrer_name: 'Tim B.',   umsatz_euro: 78.20,  umsatz_vorwoche: 95.40,  touren_heute: 3, trend: 'fallend',  trend_delta: -17, ampel: 'rot',   rang: 1 },
    { fahrer_id: 'mock-f2', fahrer_name: 'Sara K.',  umsatz_euro: 154.80, umsatz_vorwoche: 162.30, touren_heute: 5, trend: 'stabil',   trend_delta: -7,  ampel: 'gelb',  rang: 2 },
    { fahrer_id: 'mock-f4', fahrer_name: 'Julia F.', umsatz_euro: 231.00, umsatz_vorwoche: 210.50, touren_heute: 7, trend: 'steigend', trend_delta: 20,  ampel: 'gruen', rang: 3 },
    { fahrer_id: 'mock-f1', fahrer_name: 'Max M.',   umsatz_euro: 287.50, umsatz_vorwoche: 265.00, touren_heute: 8, trend: 'steigend', trend_delta: 22,  ampel: 'gruen', rang: 4 },
  ],
  team_total_euro: 751.50,
  team_avg_euro: 187.88,
  alert_count: 1,
};

export function DispatchPhase2508UmsatzBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-umsatz?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted = [...data.fahrer].sort((a, b) => a.umsatz_euro - b.umsatz_euro);
  const hasAlert = data.alert_count > 0;
  const teamCls = ampelClass(data.team_avg_euro);
  const alertFahrer = data.fahrer.filter(f => f.ampel === 'rot').map(f => f.fahrer_name);

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Euro size={16} className={hasAlert ? 'text-red-600' : 'text-emerald-600'} />
          <span className="text-sm font-bold text-gray-800">Umsatz-Board</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${teamCls.text} ${teamCls.bg}`}>
            Gesamt {data.team_total_euro.toFixed(0)}€
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
              <div className="text-[10px] text-gray-500 font-medium">Team-Gesamt</div>
              <div className={`text-lg font-black tabular-nums ${teamCls.text}`}>{data.team_total_euro.toFixed(0)}€</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-2 text-center">
              <div className="text-[10px] text-gray-500 font-medium">Ø je Fahrer</div>
              <div className={`text-lg font-black tabular-nums ${teamCls.text}`}>{data.team_avg_euro.toFixed(0)}€</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-2 text-center">
              <div className="text-[10px] text-gray-500 font-medium">Ziel ≥200€</div>
              <div className={`text-lg font-black tabular-nums ${data.alert_count > 0 ? 'text-red-600' : 'text-green-600'}`}>{data.alert_count} Alert</div>
            </div>
          </div>

          {/* Alert Banner */}
          {alertFahrer.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-100 border border-red-200 px-3 py-2 text-xs font-semibold text-red-800">
              <AlertTriangle size={13} className="shrink-0" />
              Umsatz &lt;100€: {alertFahrer.join(', ')} — Touren erhöhen!
            </div>
          )}

          {/* Driver List */}
          <div className="space-y-2">
            {sorted.map(f => {
              const cls = ampelClass(f.umsatz_euro);
              return (
                <div key={f.fahrer_id} className={`rounded-lg border p-2 ${cls.bg}`}>
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${cls.dot}`} />
                    <span className="text-xs font-semibold text-gray-800 flex-1 truncate">{f.fahrer_name}</span>
                    <span className={`text-xs font-black tabular-nums shrink-0 ${cls.text}`}>{f.umsatz_euro.toFixed(0)}€</span>
                    <div className="flex items-center gap-0.5">
                      <TrendIcon trend={f.trend} />
                      {f.trend_delta !== 0 && (
                        <span className={`text-[9px] tabular-nums ${f.trend_delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {f.trend_delta > 0 ? '+' : ''}{f.trend_delta}€
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <EuroBar euro={f.umsatz_euro} />
                    <span className="text-[9px] text-gray-400 shrink-0">{f.touren_heute} Tour{f.touren_heute !== 1 ? 'en' : ''}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-[9px] text-gray-400">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-500" /> &lt;100€</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> 100–199€</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-green-500" /> ≥200€</span>
            <span className="ml-auto">30-Min-Polling</span>
          </div>
        </div>
      )}
    </div>
  );
}
