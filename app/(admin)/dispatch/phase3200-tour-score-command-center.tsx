'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import {
  AlertTriangle, CheckCircle2, Clock, MapPin, Navigation2, Star, Target, TrendingDown, TrendingUp,
  Trophy, Zap,
} from 'lucide-react';

// Phase 3200 — Tour-Score Command Center
// Zeigt je aktive Tour: Score-Ring (SVG), farbkodierte Stopp-Dots, ETA, Sub-Scores.
// Alert wenn Score <65. 25-Sek-Polling.

type StopRow = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: { bestellnummer: string; eta_latest: string | null } | null;
};

type TourRow = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit: string | null;
  total_distance_km: number | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: StopRow[];
};

type TourScore = {
  total: number;
  puenktlichkeit: number;
  abschluss: number;
  speed: number;
  trend: 'up' | 'down' | 'flat';
};

function calcTourScore(tour: TourRow): TourScore {
  const stops = tour.stops ?? [];
  const total = stops.length;
  const done = stops.filter(s => s.geliefert_am !== null).length;

  const abschluss = total > 0 ? Math.round((done / total) * 100) : 0;

  // Punctuality: fraction of delivered stops on time (before eta_latest)
  const now = new Date();
  let onTimeCount = 0;
  let deliveredCount = 0;
  for (const s of stops) {
    if (!s.geliefert_am) continue;
    deliveredCount++;
    const eta = s.order?.eta_latest ? new Date(s.order.eta_latest) : null;
    if (!eta || new Date(s.geliefert_am) <= eta) onTimeCount++;
  }
  const puenktlichkeit = deliveredCount > 0 ? Math.round((onTimeCount / deliveredCount) * 100) : 100;

  // Speed: based on how quickly remaining stops can be done
  const remaining = total - done;
  const startzeit = tour.startzeit ? new Date(tour.startzeit) : null;
  const elapsedMin = startzeit ? (now.getTime() - startzeit.getTime()) / 60_000 : 0;
  const etaMin = tour.total_eta_min ?? 30;
  const speed = elapsedMin > 0 && etaMin > 0
    ? Math.min(100, Math.round((done / Math.max(elapsedMin / etaMin, 0.1)) * 100 / total * 100))
    : 80;

  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  const raw = clamp(puenktlichkeit * 0.4 + abschluss * 0.4 + speed * 0.2);

  // Simple trend from previous tick would need state; use heuristic
  const trend: TourScore['trend'] = raw >= 75 ? 'up' : raw >= 55 ? 'flat' : 'down';

  return { total: clamp(raw), puenktlichkeit: clamp(puenktlichkeit), abschluss: clamp(abschluss), speed: clamp(speed), trend };
}

function ScoreRing({ score, size = 52 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? '#22c55e' : score >= 65 ? '#eab308' : '#ef4444';
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fontSize={12} fontWeight="bold" fill={color}>
        {score}
      </text>
    </svg>
  );
}

function StopDot({ done, late }: { done: boolean; late: boolean }) {
  return (
    <div className={cn(
      'w-2.5 h-2.5 rounded-full border-2',
      done
        ? late ? 'bg-orange-400 border-orange-500' : 'bg-green-400 border-green-500'
        : 'bg-gray-200 border-gray-300',
    )} />
  );
}

export function DispatchPhase3200TourScoreCommandCenter() {
  const supabase = createClient();
  const [tours, setTours] = useState<TourRow[]>([]);
  const [scores, setScores] = useState<Map<string, TourScore>>(new Map());

  async function loadData() {
    const { data } = await supabase
      .from('batches')
      .select(`
        id, status, fahrer_id, startzeit, total_distance_km, total_eta_min, zone,
        fahrer:driver_profiles(vorname,nachname),
        stops:batch_stops(id,reihenfolge,geliefert_am,order:orders(bestellnummer,eta_latest))
      `)
      .in('status', ['aktiv', 'unterwegs'])
      .order('startzeit', { ascending: false })
      .limit(10);

    if (!data) return;

    const scoreMap = new Map<string, TourScore>();
    for (const tour of data as TourRow[]) {
      scoreMap.set(tour.id, calcTourScore(tour));
    }

    const sorted = [...(data as TourRow[])].sort((a, b) => {
      const sa = scoreMap.get(a.id)?.total ?? 0;
      const sb = scoreMap.get(b.id)?.total ?? 0;
      return sa - sb; // worst first
    });

    setTours(sorted);
    setScores(scoreMap);
  }

  useEffect(() => {
    loadData();
    const iv = setInterval(loadData, 25_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!tours.length) return null;

  const avgScore = tours.length > 0
    ? Math.round([...scores.values()].reduce((s, v) => s + v.total, 0) / scores.size)
    : 0;
  const alerts = tours.filter(t => (scores.get(t.id)?.total ?? 100) < 65).length;

  return (
    <div className="rounded-xl border border-indigo-200 bg-white p-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-bold text-gray-800">Tour-Score Command Center</span>
          {alerts > 0 && (
            <span className="text-xs font-bold bg-red-600 text-white rounded px-1.5 py-0.5 animate-pulse">
              {alerts} Alert{alerts > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Trophy className="w-3.5 h-3.5 text-yellow-500" />
          <span className={cn(
            'text-xs font-bold',
            avgScore >= 80 ? 'text-green-700' : avgScore >= 65 ? 'text-yellow-700' : 'text-red-700',
          )}>
            Ø {avgScore} Pkt
          </span>
        </div>
      </div>

      {/* Tour cards */}
      <div className="flex flex-col gap-2.5">
        {tours.map(tour => {
          const score = scores.get(tour.id);
          if (!score) return null;
          const stops = tour.stops ?? [];
          const done = stops.filter(s => s.geliefert_am !== null).length;
          const fahrer = tour.fahrer
            ? `${tour.fahrer.vorname} ${tour.fahrer.nachname}`
            : 'Unbekannt';
          const isAlert = score.total < 65;

          return (
            <div
              key={tour.id}
              className={cn(
                'rounded-lg border p-2.5 flex gap-3 items-start transition-all',
                isAlert ? 'border-red-300 bg-red-50' : score.total >= 80 ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50',
              )}
            >
              {/* Score ring */}
              <ScoreRing score={score.total} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-gray-800 truncate">{fahrer}</span>
                  {tour.zone && (
                    <span className="text-xs bg-indigo-100 text-indigo-700 rounded px-1 py-0.5">{tour.zone}</span>
                  )}
                  {score.trend === 'up' && <TrendingUp className="w-3 h-3 text-green-600" />}
                  {score.trend === 'down' && <TrendingDown className="w-3 h-3 text-red-500" />}
                  {isAlert && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                </div>

                {/* Sub-scores */}
                <div className="flex gap-2 mt-1">
                  <div className="flex items-center gap-0.5">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-600">{score.puenktlichkeit}%</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-600">{score.abschluss}%</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Zap className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-600">{score.speed}%</span>
                  </div>
                </div>

                {/* Stop dots */}
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  {stops
                    .sort((a, b) => a.reihenfolge - b.reihenfolge)
                    .map(s => (
                      <StopDot
                        key={s.id}
                        done={!!s.geliefert_am}
                        late={!!s.geliefert_am && !!s.order?.eta_latest && new Date(s.geliefert_am) > new Date(s.order.eta_latest)}
                      />
                    ))}
                  <span className="text-xs text-gray-500 ml-1">{done}/{stops.length}</span>
                </div>
              </div>

              {/* ETA + distance */}
              <div className="shrink-0 text-right">
                {tour.total_eta_min && (
                  <div className="flex items-center gap-1 justify-end">
                    <Navigation2 className="w-3 h-3 text-blue-500" />
                    <span className="text-xs font-bold text-blue-700">{tour.total_eta_min} min</span>
                  </div>
                )}
                {tour.total_distance_km && (
                  <div className="flex items-center gap-1 justify-end mt-0.5">
                    <MapPin className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-500">{tour.total_distance_km.toFixed(1)} km</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
