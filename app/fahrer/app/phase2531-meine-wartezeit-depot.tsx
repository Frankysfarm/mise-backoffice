'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

interface SingleEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_wartezeit_depot_min: number;
  avg_wartezeit_depot_vw: number | null;
  intervalle_anzahl: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface SingleData {
  fahrer_single: SingleEntry;
  team_avg_wartezeit_depot_min: number;
}

function ampelStyle(min: number) {
  if (min > 20) return { text: 'text-red-600', bg: 'bg-red-50 border-red-200', bar: 'bg-red-500', label: 'Zu lang — Disposition prüfen' };
  if (min > 10) return { text: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', bar: 'bg-amber-400', label: 'Verbesserungsbedarf' };
  return { text: 'text-green-600', bg: 'bg-green-50 border-green-200', bar: 'bg-green-500', label: 'Optimal' };
}

function coachingTipp(min: number): string {
  if (min > 20) return 'Lange Depot-Wartezeiten kosten Effizienz. Sprich mit der Disposition für bessere Tourenplanung.';
  if (min > 10) return 'Deine Depot-Wartezeit kann noch sinken. Frühzeitiger Check-in hilft!';
  return 'Hervorragend! Kurze Wartezeiten am Depot bedeuten mehr Touren und mehr Verdienst.';
}

function TrendIcon({ trend }: { trend: 'steigend' | 'fallend' | 'stabil' }) {
  if (trend === 'steigend') return <TrendingUp size={14} className="text-red-500" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-green-600" />;
  return <Minus size={14} className="text-gray-400" />;
}

const MOCK: SingleData = {
  fahrer_single: {
    fahrer_id: 'me',
    fahrer_name: 'Ich',
    avg_wartezeit_depot_min: 14.7,
    avg_wartezeit_depot_vw: 14.2,
    intervalle_anzahl: 6,
    trend: 'stabil',
    trend_delta: 0.5,
    ampel: 'gelb',
  },
  team_avg_wartezeit_depot_min: 15.5,
};

export function FahrerPhase2531MeineWartezeitDepot({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<SingleData | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    if (!locationId) { setData(MOCK); return; }
    const params = new URLSearchParams({ location_id: locationId });
    if (driverId) params.set('driver_id', driverId);
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-wartezeit-depot?${params}`)
        .then(r => r.json())
        .then((res: SingleData | { fahrer: SingleEntry[]; team_avg_wartezeit_depot_min: number }) => {
          if ('fahrer_single' in res && res.fahrer_single) {
            setData(res as SingleData);
          } else if ('fahrer' in res && Array.isArray(res.fahrer) && res.fahrer.length > 0) {
            const all = res as { fahrer: SingleEntry[]; team_avg_wartezeit_depot_min: number };
            const me = driverId ? all.fahrer.find((f) => f.fahrer_id === driverId) : null;
            setData({ fahrer_single: me ?? all.fahrer[0], team_avg_wartezeit_depot_min: all.team_avg_wartezeit_depot_min });
          } else {
            setData(MOCK);
          }
        })
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data) return null;

  const f = data.fahrer_single;
  const style = ampelStyle(f.avg_wartezeit_depot_min);
  const maxMin = 30;
  const barW = Math.min(100, (f.avg_wartezeit_depot_min / maxMin) * 100);

  return (
    <div className={`rounded-xl border ${style.bg} shadow-sm`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className={style.text} />
          <span className="text-sm font-bold text-gray-800">Meine Wartezeit am Depot</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${style.text} border ${style.bg}`}>
            {f.avg_wartezeit_depot_min.toFixed(1)} min
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-4">
          {/* Big number */}
          <div className="text-center">
            <div className={`text-4xl font-black tabular-nums ${style.text}`}>{f.avg_wartezeit_depot_min.toFixed(1)}<span className="text-xl ml-1">min</span></div>
            <div className="text-xs text-gray-500 mt-0.5">{style.label}</div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="relative h-3 rounded-full bg-gray-200">
              <div
                className={`absolute left-0 top-0 h-full rounded-full transition-all ${style.bar}`}
                style={{ width: `${barW}%` }}
              />
              <div className="absolute top-0 h-full border-l-2 border-dashed border-amber-400" style={{ left: `${(10 / maxMin) * 100}%` }} title="Ziel ≤10min" />
              <div className="absolute top-0 h-full border-l-2 border-dashed border-red-500" style={{ left: `${(20 / maxMin) * 100}%` }} title="Alert >20min" />
            </div>
            <div className="flex justify-between text-[9px] text-gray-400">
              <span>0</span>
              <span className="text-amber-500">10 min</span>
              <span className="text-red-500">20 min</span>
              <span>30 min</span>
            </div>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white/70 p-2 text-center">
              <div className="text-[10px] text-gray-500 font-medium">Vorwoche</div>
              <div className="flex items-center justify-center gap-1">
                <span className="text-sm font-black tabular-nums text-gray-700">
                  {f.avg_wartezeit_depot_vw !== null ? `${f.avg_wartezeit_depot_vw.toFixed(1)} min` : '–'}
                </span>
                <TrendIcon trend={f.trend} />
              </div>
            </div>
            <div className="rounded-lg bg-white/70 p-2 text-center">
              <div className="text-[10px] text-gray-500 font-medium">Team-Ø</div>
              <div className="text-sm font-black tabular-nums text-gray-700">{data.team_avg_wartezeit_depot_min.toFixed(1)} min</div>
            </div>
            <div className="rounded-lg bg-white/70 p-2 text-center">
              <div className="text-[10px] text-gray-500 font-medium">Trend</div>
              <div className="flex items-center justify-center gap-1">
                <TrendIcon trend={f.trend} />
                <span className="text-sm font-bold text-gray-700">
                  {f.trend_delta !== 0 ? `${f.trend_delta > 0 ? '+' : ''}${f.trend_delta.toFixed(1)} min` : '±0'}
                </span>
              </div>
            </div>
            <div className="rounded-lg bg-white/70 p-2 text-center">
              <div className="text-[10px] text-gray-500 font-medium">Intervalle</div>
              <div className="text-sm font-black tabular-nums text-gray-700">{f.intervalle_anzahl}</div>
            </div>
          </div>

          {/* Coaching tip */}
          <div className="rounded-lg bg-white/60 border border-gray-200 px-3 py-2 text-xs text-gray-600">
            💡 {coachingTipp(f.avg_wartezeit_depot_min)}
          </div>
        </div>
      )}
    </div>
  );
}
