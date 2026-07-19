'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Route } from 'lucide-react';

interface FahrerSingle {
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
  fahrer: FahrerSingle[];
  team_avg_km: number;
  alert_count: number;
}

function ampelStyle(km: number) {
  if (km <= 5) return { bg: 'bg-green-50 border-green-200', text: 'text-green-700', val: 'text-green-600' };
  if (km <= 10) return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', val: 'text-amber-600' };
  return { bg: 'bg-red-50 border-red-200', text: 'text-red-700', val: 'text-red-600' };
}

function KmBar({ km }: { km: number }) {
  const max = 15;
  const w = Math.min(100, (km / max) * 100);
  const color = km <= 5 ? 'bg-green-500' : km <= 10 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="relative h-3 rounded-full bg-gray-200 w-full">
      <div className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${w}%` }} />
      <div className="absolute top-0 h-full border-l-2 border-dashed border-green-600" style={{ left: `${(5 / max) * 100}%` }} title="Ziel: 5 km" />
      <div className="absolute top-0 h-full border-l-2 border-dashed border-red-400" style={{ left: `${(10 / max) * 100}%` }} title="Alert: 10 km" />
    </div>
  );
}

function coachingTipp(km: number): string {
  if (km <= 5) return `Super! Ø ${km.toFixed(1)} km/Auftrag — du nutzt deine Routen sehr effizient.`;
  if (km <= 10) return `Ø ${km.toFixed(1)} km/Auftrag — noch im Rahmen. Kürzere Routen oder Bündelung anstreben.`;
  return `Ø ${km.toFixed(1)} km/Auftrag — über dem Ziel! Bitte Dispatcher kontaktieren für bessere Tourenplanung.`;
}

const MOCK: ApiData = {
  fahrer: [{ driver_id: 'me', name: 'Ich', km_per_auftrag: 4.5, auftraege: 11, effizienz_score: 81, trend: 'besser', trend_delta: 0.9, alert: false }],
  team_avg_km: 6.7,
  alert_count: 0,
};

export function FahrerPhase2484MeineKmEffizienz({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-km-effizienz?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId, isOnline]);

  if (!isOnline || !data) return null;

  const me = driverId ? data.fahrer.find(f => f.driver_id === driverId) : data.fahrer[0];
  if (!me) return null;

  const style = ampelStyle(me.km_per_auftrag);
  const tipp = coachingTipp(me.km_per_auftrag);

  return (
    <div className={`rounded-xl border ${style.bg} shadow-sm`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Route size={16} className={style.text} />
          <span className="text-sm font-bold text-gray-800">Meine KM-Effizienz</span>
          <span className={`text-sm font-black tabular-nums ${style.val}`}>
            {me.km_per_auftrag.toFixed(1)} km/Auftr.
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          {/* Big Value */}
          <div className="flex items-end gap-3">
            <div className={`text-4xl font-black tabular-nums ${style.val}`}>
              {me.km_per_auftrag.toFixed(1)}
            </div>
            <div className="pb-1">
              <div className="text-xs font-bold text-gray-500">km / Auftrag</div>
              <div className="flex items-center gap-1 text-[10px] text-gray-400">
                {me.trend === 'besser' ? <TrendingDown size={11} className="text-green-600" /> :
                 me.trend === 'schlechter' ? <TrendingUp size={11} className="text-red-500" /> :
                 <Minus size={11} className="text-gray-400" />}
                {me.trend_delta !== 0 ? `${me.trend_delta > 0 ? '+' : ''}${me.trend_delta.toFixed(1)} km vs. VW` : 'Stabil vs. VW'}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <KmBar km={me.km_per_auftrag} />
            <div className="flex justify-between text-[9px] text-gray-400">
              <span>0 km</span>
              <span className="text-green-600 font-bold">Ziel 5</span>
              <span className="text-red-400">Alert 10</span>
              <span>15 km</span>
            </div>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: 'Heute', val: `${me.km_per_auftrag.toFixed(1)} km`, col: style.val },
              { label: 'Aufträge', val: `${me.auftraege}`, col: 'text-gray-700' },
              { label: 'Effizienz', val: `${me.effizienz_score}%`, col: me.effizienz_score >= 75 ? 'text-green-700' : me.effizienz_score >= 50 ? 'text-amber-700' : 'text-red-700' },
              { label: 'Team-Ø', val: `${data.team_avg_km.toFixed(1)} km`, col: 'text-blue-700' },
            ].map(k => (
              <div key={k.label} className="rounded-lg bg-white/60 px-2 py-2 text-center">
                <div className={`text-sm font-black ${k.col}`}>{k.val}</div>
                <div className="text-[9px] text-gray-400 mt-0.5">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Coaching Tip */}
          <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${style.bg} ${style.text}`}>
            💡 {tipp}
          </div>
        </div>
      )}
    </div>
  );
}
