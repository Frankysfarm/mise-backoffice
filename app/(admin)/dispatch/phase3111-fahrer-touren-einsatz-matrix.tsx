'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, Bike, MapPin, TrendingUp, TrendingDown } from 'lucide-react';

interface FahrerEinsatz {
  fahrer_id: string;
  fahrer_name: string;
  stopps_h: number;
  km_tour: number;
  score: number;
  aktive_tour: boolean;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  fahrer: FahrerEinsatz[];
  team_stopps_h: number;
  team_km_tour: number;
  team_score: number;
  alert_count: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.', stopps_h: 4.2, km_tour: 6.8, score: 91, aktive_tour: true, ampel: 'gruen' },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', stopps_h: 3.8, km_tour: 7.4, score: 83, aktive_tour: true, ampel: 'gruen' },
    { fahrer_id: 'f3', fahrer_name: 'Lars K.', stopps_h: 2.9, km_tour: 11.2, score: 62, aktive_tour: true, ampel: 'gelb' },
    { fahrer_id: 'f4', fahrer_name: 'Sara B.', stopps_h: 2.1, km_tour: 14.5, score: 44, aktive_tour: false, ampel: 'rot' },
  ],
  team_stopps_h: 3.25,
  team_km_tour: 9.97,
  team_score: 70,
  alert_count: 1,
};

const AMPEL_DOT: Record<string, string> = {
  gruen: 'bg-emerald-500',
  gelb: 'bg-amber-500',
  rot: 'bg-red-500',
};

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
    : score >= 60 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
    : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
  return <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${color}`}>{score}</span>;
}

export function DispatchPhase3111FahrerTourenEinsatzMatrix() {
  const [data, setData] = useState<ApiData>(MOCK);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/delivery/admin/fahrer-einsatz-matrix', { cache: 'no-store' });
        if (res.ok) setData(await res.json());
      } catch {}
    }
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="rounded-xl border bg-white dark:bg-zinc-900 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bike className="w-4 h-4 text-emerald-600" />
          <span className="font-semibold text-sm">Fahrer Einsatz-Matrix</span>
        </div>
        {data.alert_count > 0 && (
          <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium">
            <AlertTriangle className="w-3.5 h-3.5" /> {data.alert_count} schwache Leistung
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 p-2">
          <div className="font-bold text-base">{data.team_stopps_h.toFixed(1)}</div>
          <div className="text-zinc-500">Ø Stopps/h</div>
        </div>
        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 p-2">
          <div className="font-bold text-base">{data.team_km_tour.toFixed(1)} km</div>
          <div className="text-zinc-500">Ø km/Tour</div>
        </div>
        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 p-2">
          <div className="font-bold text-base">{data.team_score}</div>
          <div className="text-zinc-500">Team-Score</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-400 border-b dark:border-zinc-700">
              <th className="text-left py-1.5 pr-2">Fahrer</th>
              <th className="text-right pr-2">Stopps/h</th>
              <th className="text-right pr-2">km/Tour</th>
              <th className="text-right">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-zinc-800">
            {data.fahrer.map((f) => (
              <tr key={f.fahrer_id} className="py-1">
                <td className="py-1.5 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${AMPEL_DOT[f.ampel]}`} />
                    <span className="font-medium truncate max-w-[80px]">{f.fahrer_name}</span>
                    {!f.aktive_tour && <span className="text-zinc-400 text-xs">(frei)</span>}
                  </div>
                </td>
                <td className="text-right pr-2">
                  <div className="flex items-center justify-end gap-0.5">
                    {f.stopps_h >= data.team_stopps_h
                      ? <TrendingUp className="w-3 h-3 text-emerald-500" />
                      : <TrendingDown className="w-3 h-3 text-red-400" />}
                    {f.stopps_h.toFixed(1)}
                  </div>
                </td>
                <td className="text-right pr-2">
                  <div className="flex items-center justify-end gap-0.5">
                    <MapPin className="w-3 h-3 text-zinc-400" />
                    {f.km_tour.toFixed(1)}
                  </div>
                </td>
                <td className="text-right"><ScoreBadge score={f.score} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
