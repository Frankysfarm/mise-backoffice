'use client';
import { useEffect, useState } from 'react';
import { Clock, MapPin, TrendingUp } from 'lucide-react';

interface ApiData {
  stopps_erledigt: number;
  stopps_gesamt: number;
  tour_score: number;
  eta_naechster_min: number | null;
  eta_gesamt_min: number | null;
  prognose_fertig: string | null;
  avg_min_pro_stopp: number | null;
  km_gefahren: number | null;
}

const MOCK: ApiData = {
  stopps_erledigt: 2,
  stopps_gesamt: 5,
  tour_score: 78,
  eta_naechster_min: 6,
  eta_gesamt_min: 31,
  prognose_fertig: '18:15',
  avg_min_pro_stopp: 9.5,
  km_gefahren: 8.4,
};

function ProgressRing({ pct, score }: { pct: number; score: number }) {
  const r = 34, cx = 40, cy = 40, circ = 2 * Math.PI * r;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={80} height={80} viewBox="0 0 80 80">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={8} className="dark:stroke-zinc-700" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${(pct / 100) * circ} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy - 5} textAnchor="middle" fontSize={15} fontWeight="bold" fill={color}>{Math.round(pct)}%</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize={10} fill="#6b7280">Stopps</text>
    </svg>
  );
}

export function FahrerPhase3117TourFortschrittsLiveCockpit() {
  const [data, setData] = useState<ApiData>(MOCK);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/delivery/fahrer/tour-fortschritt-live', { cache: 'no-store' });
        if (res.ok) setData(await res.json());
      } catch {}
    }
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, []);

  const pct = data.stopps_gesamt > 0 ? (data.stopps_erledigt / data.stopps_gesamt) * 100 : 0;
  const scoreColor = data.tour_score >= 80 ? 'text-emerald-600 dark:text-emerald-400'
    : data.tour_score >= 60 ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <div className="rounded-xl border bg-white dark:bg-zinc-900 p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-emerald-500" />
        <span className="font-semibold text-sm">Tour Fortschritt Live</span>
      </div>

      <div className="flex items-center gap-4">
        <ProgressRing pct={pct} score={data.tour_score} />
        <div className="flex-1 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Stopps</span>
            <span className="font-bold">{data.stopps_erledigt} / {data.stopps_gesamt}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Tour-Score</span>
            <span className={`font-bold ${scoreColor}`}>{data.tour_score}</span>
          </div>
          {data.eta_naechster_min !== null && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Nächster Stopp</span>
              <span className="font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {data.eta_naechster_min} Min
              </span>
            </div>
          )}
          {data.km_gefahren !== null && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Gefahren</span>
              <span className="font-medium flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> {data.km_gefahren.toFixed(1)} km
              </span>
            </div>
          )}
        </div>
      </div>

      {(data.prognose_fertig || data.eta_gesamt_min !== null) && (
        <div className="mt-3 pt-3 border-t dark:border-zinc-800 flex justify-between text-xs text-zinc-500">
          {data.eta_gesamt_min !== null && (
            <span>Noch <strong className="text-zinc-700 dark:text-zinc-300">{data.eta_gesamt_min} Min</strong> bis Tour-Ende</span>
          )}
          {data.prognose_fertig && (
            <span>Fertig ca. <strong className="text-zinc-700 dark:text-zinc-300">{data.prognose_fertig} Uhr</strong></span>
          )}
        </div>
      )}
    </div>
  );
}
