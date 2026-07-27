'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, AlertTriangle, Star, Zap, Clock, Route } from 'lucide-react';

interface DriverScoreRow {
  driver_id: string;
  driver_name: string;
  gesamt_score: number;
  puenktlichkeit_score: number;
  geschwindigkeit_score: number;
  effizienz_score: number;
  bewertung_score: number;
  aktive_tour: boolean;
  alert: boolean;
}

interface ApiData {
  drivers: DriverScoreRow[];
  flotte_avg_score: number;
  top_driver_name: string;
  alert_count: number;
}

const MOCK: ApiData = {
  drivers: [
    { driver_id: 'd1', driver_name: 'Max M.',   gesamt_score: 88, puenktlichkeit_score: 92, geschwindigkeit_score: 85, effizienz_score: 90, bewertung_score: 87, aktive_tour: true,  alert: false },
    { driver_id: 'd2', driver_name: 'Julia F.', gesamt_score: 79, puenktlichkeit_score: 80, geschwindigkeit_score: 78, effizienz_score: 76, bewertung_score: 82, aktive_tour: true,  alert: false },
    { driver_id: 'd3', driver_name: 'Sara K.',  gesamt_score: 72, puenktlichkeit_score: 70, geschwindigkeit_score: 74, effizienz_score: 68, bewertung_score: 75, aktive_tour: false, alert: false },
    { driver_id: 'd4', driver_name: 'Tim B.',   gesamt_score: 61, puenktlichkeit_score: 58, geschwindigkeit_score: 63, effizienz_score: 55, bewertung_score: 68, aktive_tour: true,  alert: true  },
  ],
  flotte_avg_score: 75,
  top_driver_name: 'Max M.',
  alert_count: 1,
};

function scoreBg(s: number): string {
  if (s >= 85) return 'bg-emerald-100 text-emerald-700';
  if (s >= 70) return 'bg-yellow-100 text-yellow-700';
  if (s >= 55) return 'bg-orange-100 text-orange-700';
  return 'bg-red-100 text-red-700';
}

const COLS = [
  { key: 'puenktlichkeit_score', icon: <Clock className="w-2.5 h-2.5" />, label: 'Pünkt.' },
  { key: 'geschwindigkeit_score', icon: <Zap className="w-2.5 h-2.5" />, label: 'Geschw.' },
  { key: 'effizienz_score', icon: <Route className="w-2.5 h-2.5" />, label: 'Effiz.' },
  { key: 'bewertung_score', icon: <Star className="w-2.5 h-2.5" />, label: 'Bewert.' },
] as const;

interface Props {
  locationId: string | null;
}

export function DispatchPhase4038TourScoreMatrix({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/dispatch/tour-score-matrix?location_id=${locationId}`);
      if (res.ok) {
        const json = await res.json();
        if (!json.error) setData(json);
      }
    } catch {
      // Mock-Fallback
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [load]);

  const fleetColor =
    data.flotte_avg_score >= 80 ? 'text-emerald-600' :
    data.flotte_avg_score >= 65 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs font-semibold text-gray-900">Tour-Score Matrix</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {data.alert_count > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-red-600 font-bold">
              <AlertTriangle className="w-3 h-3" /> {data.alert_count}
            </span>
          )}
          <span className={`text-[10px] font-bold ${fleetColor}`}>Ø {data.flotte_avg_score}</span>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[auto_repeat(4,1fr)_auto] gap-1 text-[9px] text-gray-400 font-medium">
        <span />
        {COLS.map((c) => (
          <span key={c.key} className="text-center flex flex-col items-center gap-0.5">
            {c.icon}
            {c.label}
          </span>
        ))}
        <span className="text-center">Gesamt</span>
      </div>

      {/* Driver rows */}
      <div className="space-y-1">
        {data.drivers.map((d) => (
          <div key={d.driver_id} className={`grid grid-cols-[auto_repeat(4,1fr)_auto] gap-1 items-center ${d.alert ? 'opacity-100' : ''}`}>
            <div className="flex items-center gap-1 min-w-[52px]">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${d.aktive_tour ? 'bg-emerald-400' : 'bg-gray-300'}`} />
              <span className="text-[9px] text-gray-700 truncate">{d.driver_name.split(' ')[0]}</span>
            </div>
            {COLS.map((c) => {
              const val = d[c.key];
              return (
                <span
                  key={c.key}
                  className={`text-center text-[9px] font-bold rounded px-0.5 py-0.5 ${scoreBg(val)}`}
                >
                  {val}
                </span>
              );
            })}
            <span className={`text-center text-[10px] font-bold rounded px-1 py-0.5 ${scoreBg(d.gesamt_score)}`}>
              {d.gesamt_score}
            </span>
          </div>
        ))}
      </div>

      <div className="flex justify-between text-[9px] text-gray-400 border-t border-gray-100 pt-1">
        <span>Flotte Ø: <span className={`font-semibold ${fleetColor}`}>{data.flotte_avg_score}</span></span>
        <span>Top: <span className="text-amber-600 font-semibold">{data.top_driver_name}</span></span>
        {/* API: /api/delivery/dispatch/tour-score-matrix */}
      </div>
    </div>
  );
}
