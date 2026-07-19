'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Route } from 'lucide-react';

interface FahrerKm {
  driver_id: string;
  name: string;
  km_per_auftrag: number;
  auftraege: number;
  effizienz_score: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  trend_delta: number;
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerKm[];
  team_avg_km: number;
  alert_count: number;
}

function ampelClass(km: number) {
  if (km <= 5) return { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700' };
  if (km <= 10) return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700' };
  return { bg: 'bg-red-50 border-red-200', dot: 'bg-red-500', text: 'text-red-700' };
}

function KmBar({ km }: { km: number }) {
  const max = 15;
  const w = Math.min(100, (km / max) * 100);
  const color = km <= 5 ? 'bg-green-500' : km <= 10 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="relative h-1.5 rounded-full bg-gray-200 w-24">
      <div className={`absolute left-0 top-0 h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
      <div className="absolute top-0 h-full border-l border-dashed border-gray-400" style={{ left: `${(5 / max) * 100}%` }} title="5 km" />
      <div className="absolute top-0 h-full border-l border-dashed border-gray-600" style={{ left: `${(10 / max) * 100}%` }} title="10 km" />
    </div>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'besser') return <TrendingDown size={12} className="text-green-600" />;
  if (trend === 'schlechter') return <TrendingUp size={12} className="text-red-500" />;
  return <Minus size={12} className="text-gray-400" />;
}

const MOCK: ApiData = {
  fahrer: [
    { driver_id: 'd1', name: 'Max M.',   km_per_auftrag: 3.2,  auftraege: 12, effizienz_score: 92, trend: 'besser',     trend_delta: 0.4, alert: false },
    { driver_id: 'd2', name: 'Sarah K.', km_per_auftrag: 5.8,  auftraege: 9,  effizienz_score: 71, trend: 'gleich',     trend_delta: 0,   alert: false },
    { driver_id: 'd3', name: 'Tom B.',   km_per_auftrag: 13.1, auftraege: 7,  effizienz_score: 31, trend: 'schlechter', trend_delta: 2.1, alert: true  },
    { driver_id: 'd4', name: 'Anna L.',  km_per_auftrag: 4.5,  auftraege: 11, effizienz_score: 81, trend: 'besser',     trend_delta: 0.9, alert: false },
  ],
  team_avg_km: 6.7,
  alert_count: 1,
};

export function DispatchPhase2483KmEffizienzBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-km-effizienz?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted = [...data.fahrer].sort((a, b) => b.km_per_auftrag - a.km_per_auftrag);
  const hasAlert = data.alert_count > 0;
  const teamAvg = data.team_avg_km;
  const teamAmpel = ampelClass(teamAvg);

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Route size={16} className={hasAlert ? 'text-red-600' : 'text-blue-600'} />
          <span className="text-sm font-bold text-gray-800">KM-Effizienz Board</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${teamAmpel.text} ${teamAmpel.bg}`}>
            Ø {teamAvg.toFixed(1)} km/Auftrag
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
          {/* KPI Grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Team-Ø km/Auftr.', val: `${teamAvg.toFixed(1)} km`, col: teamAmpel.text },
              { label: 'Ziel', val: '≤ 5 km',  col: 'text-green-700' },
              { label: 'Alerts', val: `${data.alert_count}`, col: hasAlert ? 'text-red-700' : 'text-gray-500' },
            ].map(k => (
              <div key={k.label} className="rounded-lg bg-gray-50 px-2 py-2 text-center">
                <div className={`text-base font-black ${k.col}`}>{k.val}</div>
                <div className="text-[9px] text-gray-500 mt-0.5">{k.label}</div>
              </div>
            ))}
          </div>

          {hasAlert && (
            <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-100 px-3 py-2 text-xs font-semibold text-red-800">
              <AlertTriangle size={14} className="shrink-0" />
              {data.alert_count} Fahrer über 10 km/Auftrag — Routen prüfen und optimieren!
            </div>
          )}

          <div className="space-y-1.5">
            {sorted.map(f => {
              const cls = ampelClass(f.km_per_auftrag);
              return (
                <div key={f.driver_id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${cls.bg}`}>
                  <span className={`h-2 w-2 rounded-full shrink-0 ${cls.dot}`} />
                  <span className="text-xs font-semibold text-gray-800 w-20 truncate">{f.name}</span>
                  <KmBar km={f.km_per_auftrag} />
                  <span className={`text-xs font-black w-14 text-right tabular-nums ${cls.text}`}>
                    {f.km_per_auftrag.toFixed(1)} km
                  </span>
                  <span className="text-[10px] text-gray-400 w-10 text-right">{f.auftraege} Auftr.</span>
                  <TrendIcon trend={f.trend} />
                  {f.alert && <AlertTriangle size={11} className="text-red-500 shrink-0" />}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 text-[9px] text-gray-400">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500 inline-block" />≤ 5 km</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />5–10 km</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" />&gt;10 km</span>
            <span className="ml-auto">30-Min-Polling · Ziel: ≤ 5 km/Auftrag</span>
          </div>
        </div>
      )}
    </div>
  );
}
