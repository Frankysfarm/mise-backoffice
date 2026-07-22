'use client';
import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, ChevronDown, ChevronUp, Clock, Flame, TrendingDown, TrendingUp, Zap } from 'lucide-react';

interface StationStat {
  name: string;
  avg_prep_min: number;
  ziel_min: number;
  aktive_orders: number;
  on_time_pct: number;
  trend: 'up' | 'down' | 'flat';
}

interface ApiData {
  gesamt_on_time_pct: number;
  gesamt_avg_min: number;
  ziel_min: number;
  aktive_orders: number;
  kritisch_count: number;
  hochlast: boolean;
  stationen: StationStat[];
  empfehlung: string | null;
}

const MOCK: ApiData = {
  gesamt_on_time_pct: 78,
  gesamt_avg_min: 19,
  ziel_min: 18,
  aktive_orders: 7,
  kritisch_count: 2,
  hochlast: true,
  empfehlung: 'Vorproduktion erhöhen: Pizza & Burger +30%',
  stationen: [
    { name: 'Pizza', avg_prep_min: 22, ziel_min: 20, aktive_orders: 3, on_time_pct: 71, trend: 'down' },
    { name: 'Burger', avg_prep_min: 14, ziel_min: 15, aktive_orders: 2, on_time_pct: 89, trend: 'up' },
    { name: 'Pasta', avg_prep_min: 18, ziel_min: 18, aktive_orders: 1, on_time_pct: 82, trend: 'flat' },
    { name: 'Salat', avg_prep_min: 8, ziel_min: 10, aktive_orders: 1, on_time_pct: 95, trend: 'up' },
  ],
};

function ampelFor(pct: number): { ring: string; text: string; label: string } {
  if (pct >= 90) return { ring: 'border-green-500', text: 'text-green-400', label: 'Sehr gut' };
  if (pct >= 78) return { ring: 'border-amber-400', text: 'text-amber-400', label: 'Ok' };
  if (pct >= 65) return { ring: 'border-orange-500', text: 'text-orange-400', label: 'Warnung' };
  return { ring: 'border-red-500', text: 'text-red-400 animate-pulse', label: 'Kritisch' };
}

function deltaColor(avg: number, ziel: number): string {
  if (avg <= ziel) return 'text-green-400';
  if (avg <= ziel * 1.1) return 'text-amber-400';
  return 'text-red-400';
}

export function KitchenPhase3295SmartTimingEchtzeitCockpit({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/kitchen/timing-stats?location_id=${locationId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    if (locationId) load(); else setData(MOCK);
    const p = setInterval(load, 30_000);
    return () => clearInterval(p);
  }, [locationId]);

  const d = data ?? MOCK;
  const amp = ampelFor(d.gesamt_on_time_pct);

  return (
    <div className="rounded-xl border border-gray-700 shadow mb-4 overflow-hidden bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-400 shrink-0" />
          <span className="text-sm font-bold text-white">Smart-Timing Echtzeit-Cockpit</span>
          {d.hochlast && (
            <span className="flex items-center gap-1 rounded-full bg-orange-700 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse">
              <Flame className="h-2.5 w-2.5" />Hochlast
            </span>
          )}
          {d.kritisch_count > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
              <AlertTriangle className="h-2.5 w-2.5" />{d.kritisch_count} kritisch
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
      </button>

      {open && (
        <div className="border-t border-gray-700 p-3 space-y-3">
          {/* KPI-Header */}
          <div className="grid grid-cols-3 gap-2">
            <div className={`rounded-lg border-2 ${amp.ring} bg-gray-800 p-2.5 text-center`}>
              <div className={`text-2xl font-black tabular-nums ${amp.text}`}>{d.gesamt_on_time_pct}%</div>
              <div className="text-[9px] text-gray-400 mt-0.5">On-Time</div>
              <div className={`text-[10px] font-semibold ${amp.text}`}>{amp.label}</div>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-800 p-2.5 text-center">
              <div className={`text-2xl font-black tabular-nums ${deltaColor(d.gesamt_avg_min, d.ziel_min)}`}>{d.gesamt_avg_min}m</div>
              <div className="text-[9px] text-gray-400 mt-0.5">Ø Prep-Zeit</div>
              <div className="text-[10px] text-gray-500">Ziel {d.ziel_min}m</div>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-800 p-2.5 text-center">
              <div className="text-2xl font-black tabular-nums text-white">{d.aktive_orders}</div>
              <div className="text-[9px] text-gray-400 mt-0.5">Aktive Orders</div>
              <div className="text-[10px] text-gray-500">in Produktion</div>
            </div>
          </div>

          {/* Stations */}
          <div className="space-y-1.5">
            {d.stationen.map(st => {
              const sAmp = ampelFor(st.on_time_pct);
              const over = st.avg_prep_min > st.ziel_min;
              return (
                <div key={st.name} className="rounded-lg bg-gray-800/60 border border-gray-700 px-3 py-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-bold text-white w-16 shrink-0">{st.name}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(100, (st.avg_prep_min / (st.ziel_min * 1.5)) * 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {st.trend === 'up' && <TrendingUp className="h-3 w-3 text-green-400" />}
                      {st.trend === 'down' && <TrendingDown className="h-3 w-3 text-red-400" />}
                      {st.trend === 'flat' && <span className="h-3 w-3 text-gray-500 text-[10px]">—</span>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-gray-400">
                    <span><span className={deltaColor(st.avg_prep_min, st.ziel_min)}>{st.avg_prep_min}m</span> / Ziel {st.ziel_min}m</span>
                    <span>{st.aktive_orders} aktiv</span>
                    <span className={sAmp.text}>{st.on_time_pct}% On-Time</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empfehlung */}
          {d.empfehlung && (
            <div className="flex items-start gap-2 rounded-lg bg-blue-950/30 border border-blue-700/40 px-3 py-2">
              <Zap className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
              <span className="text-[10px] text-blue-300">{d.empfehlung}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-[9px] text-gray-600 px-1">
            <Clock className="h-2.5 w-2.5" />
            <span>Polling alle 30 Sek</span>
          </div>
        </div>
      )}
    </div>
  );
}
