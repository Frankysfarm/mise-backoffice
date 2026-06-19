'use client';

/**
 * TourRueckkehrAnzeige — Phase 275
 *
 * Zeigt dem Fahrer seine voraussichtliche Rückkehrzeit zur Basis
 * nach Abschluss aller aktuellen Stops.
 *
 * Motivations-Widget: Timer-Ring + "Du bist um HH:MM zurück"
 * Nutzt die Phase-274-API mit driver_id als Parameter.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Home, RefreshCw } from 'lucide-react';

interface ReturnPrediction {
  minutesUntilReturn:  number;
  estimatedReturnUtc:  string;
  remainingStops:      number;
  totalStops:          number;
  confidence:          number;
  method:              string;
}

function fmtTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

const CIRCLE_R = 38;
const CIRCLE_C = 50;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_R;

export function TourRueckkehrAnzeige({ driverId, locationId }: { driverId: string; locationId: string }) {
  const [data, setData]       = useState<ReturnPrediction | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    if (!driverId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/return-prediction?location_id=${locationId}&action=driver&driver_id=${driverId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.ok && d.prediction) setData(d.prediction as ReturnPrediction);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, locationId]);

  if (!data && !loading) return null;

  const min         = data?.minutesUntilReturn ?? 0;
  const donePct     = data ? (data.totalStops - data.remainingStops) / Math.max(data.totalStops, 1) : 0;
  const returnTime  = data ? fmtTime(data.estimatedReturnUtc) : '—';
  const isOverdue   = min < 0;
  const isAlmostDone = data ? data.remainingStops <= 1 : false;

  // SVG ring progress (based on tour completion)
  const dashOffset = CIRCUMFERENCE * (1 - donePct);

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden',
      isOverdue ? 'border-red-300 bg-red-50' :
      isAlmostDone ? 'border-emerald-300 bg-emerald-50' :
      'border-stone-200 bg-white',
    )}>
      <div className="flex items-center gap-4 px-4 py-4">
        {/* SVG Ring */}
        <div className="relative shrink-0">
          <svg width="80" height="80" viewBox="0 0 100 100">
            <circle cx={CIRCLE_C} cy={CIRCLE_C} r={CIRCLE_R} fill="none" stroke="#e5e7eb" strokeWidth="8" />
            <circle
              cx={CIRCLE_C} cy={CIRCLE_C} r={CIRCLE_R}
              fill="none"
              stroke={isOverdue ? '#ef4444' : isAlmostDone ? '#10b981' : '#8b5cf6'}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 50 50)"
              style={{ transition: 'stroke-dashoffset 0.7s ease' }}
            />
            <foreignObject x="20" y="20" width="60" height="60">
              <div className="flex h-full w-full flex-col items-center justify-center">
                <Home className={cn(
                  'h-4 w-4 mb-0.5',
                  isOverdue ? 'text-red-500' : isAlmostDone ? 'text-emerald-600' : 'text-violet-600',
                )} />
                <span className={cn(
                  'text-[10px] font-black tabular-nums leading-none',
                  isOverdue ? 'text-red-700' : isAlmostDone ? 'text-emerald-700' : 'text-violet-700',
                )}>
                  {isOverdue ? 'Spät' : `${min}m`}
                </span>
              </div>
            </foreignObject>
          </svg>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-black uppercase tracking-wider text-stone-400 mb-0.5">
            Rückkehr zur Basis
          </div>
          {loading && !data ? (
            <div className="text-sm text-stone-400">Berechne…</div>
          ) : isOverdue ? (
            <>
              <div className="text-base font-black text-red-700">Du bist überfällig!</div>
              <div className="text-[11px] text-red-500 mt-0.5">War geplant für {returnTime}</div>
            </>
          ) : isAlmostDone && data?.remainingStops === 0 ? (
            <>
              <div className="text-base font-black text-emerald-700">Auf dem Weg zurück</div>
              <div className="text-[11px] text-emerald-600 mt-0.5">Alle Stops erledigt ✓</div>
            </>
          ) : (
            <>
              <div className="text-base font-black text-char">
                ~{returnTime} Uhr zurück
              </div>
              <div className="text-[11px] text-stone-500 mt-0.5">
                noch {data?.remainingStops ?? '?'} Stop{(data?.remainingStops ?? 0) !== 1 ? 's' : ''} · in ca. {min} Min
              </div>
            </>
          )}

          {/* Confidence */}
          {data && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <div className="h-1 flex-1 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full',
                    data.confidence >= 0.7 ? 'bg-emerald-400' :
                    data.confidence >= 0.5 ? 'bg-amber-400' : 'bg-red-400',
                  )}
                  style={{ width: `${data.confidence * 100}%` }}
                />
              </div>
              <span className="text-[9px] text-stone-400 font-bold shrink-0">
                {Math.round(data.confidence * 100)}% Konfidenz
              </span>
            </div>
          )}
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="shrink-0 rounded-xl p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 disabled:opacity-40 transition"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>
    </div>
  );
}
