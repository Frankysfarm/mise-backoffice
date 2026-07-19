'use client';

/**
 * Phase 2515 — Score + Tour-Visualisierung Hub
 * Kompakte Score-Anzeige je Fahrer (Ring + Badge),
 * Tour-Fortschrittsbalken mit farbkodierten Stop-Dots,
 * ETA zum nächsten Stopp, Alert bei Score < 60.
 * 25-Sek-Polling.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, AlertTriangle, ChevronDown, ChevronUp, Loader2, Navigation, MapPin } from 'lucide-react';

interface Stop {
  idx: number;
  done: boolean;
  late?: boolean;
}

interface DriverTour {
  id: string;
  name: string;
  score: number;
  stops: Stop[];
  totalStops: number;
  doneStops: number;
  etaMin: number | null;
  status: 'active' | 'idle' | 'returning';
}

interface HubData {
  drivers: DriverTour[];
  teamAvgScore: number;
  alertCount: number;
}

function ScoreRing({ score, size = 36 }: { score: number; size?: number }) {
  const r = (size - 5) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (score / 100);
  const color = score >= 80 ? '#6a9e5f' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e7e5e4" strokeWidth={4.5} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={4.5}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[9px] font-black" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

function StopDots({ stops }: { stops: Stop[] }) {
  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {stops.map(s => (
        <div
          key={s.idx}
          className={cn(
            'h-2 w-2 rounded-full',
            s.done
              ? s.late ? 'bg-amber-400' : 'bg-matcha-500'
              : 'bg-gray-200'
          )}
          title={s.done ? (s.late ? 'Verspätet' : 'Erledigt') : 'Ausstehend'}
        />
      ))}
    </div>
  );
}

function buildMock(): HubData {
  const drivers: DriverTour[] = [
    { id: '1', name: 'Max K.', score: 92, totalStops: 6, doneStops: 4, etaMin: 8, status: 'active',
      stops: [1,2,3,4,5,6].map((i,idx) => ({ idx, done: idx < 4, late: idx === 2 })) },
    { id: '2', name: 'Jana P.', score: 76, totalStops: 5, doneStops: 2, etaMin: 12, status: 'active',
      stops: [1,2,3,4,5].map((i,idx) => ({ idx, done: idx < 2 })) },
    { id: '3', name: 'Tom S.', score: 55, totalStops: 4, doneStops: 1, etaMin: 22, status: 'active',
      stops: [1,2,3,4].map((i,idx) => ({ idx, done: idx < 1, late: idx === 0 })) },
    { id: '4', name: 'Leila M.', score: 88, totalStops: 3, doneStops: 3, etaMin: 3, status: 'returning',
      stops: [1,2,3].map((i,idx) => ({ idx, done: true })) },
  ];
  return { drivers, teamAvgScore: 77, alertCount: drivers.filter(d => d.score < 60).length };
}

export function DispatchPhase2515ScoreTourVisualisierungHub({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<HubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    try {
      const params = locationId ? `?location_id=${locationId}` : '';
      const r = await fetch(`/api/delivery/dispatch/tour-scores${params}`);
      if (!r.ok) throw new Error();
      const raw = await r.json();
      const drivers: DriverTour[] = (raw.drivers ?? []).map((d: any) => ({
        id: String(d.id),
        name: d.name ?? d.fahrer_name ?? 'Unbekannt',
        score: d.score ?? 70,
        totalStops: d.total_stops ?? d.totalStops ?? 0,
        doneStops: d.done_stops ?? d.doneStops ?? 0,
        etaMin: d.eta_min ?? d.etaMin ?? null,
        status: d.status ?? 'active',
        stops: (d.stops ?? []).map((s: any, idx: number) => ({
          idx,
          done: s.done ?? false,
          late: s.late ?? false,
        })),
      }));
      setData({
        drivers,
        teamAvgScore: raw.team_avg_score ?? raw.teamAvgScore ?? 0,
        alertCount: drivers.filter(d => d.score < 60).length,
      });
    } catch {
      setData(buildMock());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 25_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (loading) return (
    <div className="flex items-center justify-center py-6">
      <Loader2 className="h-5 w-5 animate-spin text-matcha-500" />
    </div>
  );
  if (!data) return null;

  const teamColor = data.teamAvgScore >= 80 ? 'text-matcha-700' : data.teamAvgScore >= 60 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="rounded-xl border border-matcha-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-matcha-50 hover:bg-matcha-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-bold text-matcha-800">Tour-Scores & Visualisierung</span>
          {data.alertCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white">
              {data.alertCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-black tabular-nums', teamColor)}>
            Ø {Math.round(data.teamAvgScore)}
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-matcha-400" /> : <ChevronDown className="h-4 w-4 text-matcha-400" />}
        </div>
      </button>

      {open && (
        <div className="p-3 space-y-1.5">
          {data.alertCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              <span className="text-xs font-bold text-red-700">
                {data.alertCount} Fahrer mit Score &lt; 60 — Coaching empfohlen
              </span>
            </div>
          )}

          {data.drivers.map(d => {
            const pct = d.totalStops > 0 ? (d.doneStops / d.totalStops) * 100 : 0;
            const scoreColor = d.score >= 80 ? '#6a9e5f' : d.score >= 60 ? '#f59e0b' : '#ef4444';
            const isExp = expanded === d.id;
            return (
              <div
                key={d.id}
                className="rounded-lg border border-gray-100 bg-gray-50 overflow-hidden"
              >
                <button
                  className="w-full flex items-center gap-3 px-3 py-2 text-left"
                  onClick={() => setExpanded(isExp ? null : d.id)}
                >
                  <ScoreRing score={d.score} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-800 truncate">{d.name}</span>
                      {d.status === 'returning' && (
                        <span className="text-[9px] font-bold text-blue-500 bg-blue-50 border border-blue-200 px-1.5 rounded-full">
                          Rückkehr
                        </span>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: scoreColor }}
                        />
                      </div>
                      <span className="text-[9px] font-bold text-gray-500 tabular-nums shrink-0">
                        {d.doneStops}/{d.totalStops}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {d.etaMin != null && (
                      <div className="flex items-center gap-1 text-[10px] text-gray-500">
                        <MapPin className="h-3 w-3" />
                        <span className="font-bold">{d.etaMin} min</span>
                      </div>
                    )}
                    {isExp ? <ChevronUp className="h-3 w-3 text-gray-400 mt-0.5 ml-auto" /> : <ChevronDown className="h-3 w-3 text-gray-400 mt-0.5 ml-auto" />}
                  </div>
                </button>

                {isExp && (
                  <div className="px-3 pb-2 border-t border-gray-100">
                    <div className="mt-1.5 flex items-center gap-1">
                      <span className="text-[9px] text-gray-400 mr-1">Stopps:</span>
                      <StopDots stops={d.stops} />
                    </div>
                    <div className="mt-1 text-[9px] text-gray-400 flex gap-3">
                      <span><span className="inline-block h-2 w-2 rounded-full bg-matcha-500 mr-0.5" />Erledigt</span>
                      <span><span className="inline-block h-2 w-2 rounded-full bg-amber-400 mr-0.5" />Verspätet</span>
                      <span><span className="inline-block h-2 w-2 rounded-full bg-gray-200 mr-0.5" />Ausstehend</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {data.drivers.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">Keine aktiven Fahrer</p>
          )}
        </div>
      )}
    </div>
  );
}
