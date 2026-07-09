'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Battery, Clock, Coffee, Loader2, Zap } from 'lucide-react';

/**
 * phase882 — Schicht-Energieplan
 *
 * Empfohlene Pausenzeiten basierend auf Schichtlänge + bisherigen Stopps.
 * 5-Min-Polling gegen Schicht-Effizienz-API, Fallback auf Mock-Berechnung.
 */

interface ShiftData {
  shift_started_at: string | null;
  total_stops_today: number;
  active_since_min: number;
}

interface PauseEmpfehlung {
  typ: 'kurze-pause' | 'pause' | 'mahlzeit' | 'weiter';
  label: string;
  in_min: number;
  icon: string;
  urgency: 'ok' | 'bald' | 'jetzt';
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

const MOCK_SHIFT: ShiftData = {
  shift_started_at: new Date(Date.now() - 3 * 3_600_000).toISOString(),
  total_stops_today: 8,
  active_since_min: 180,
};

function calcEnergieProzent(activeSinceMin: number, stops: number): number {
  const zeitFaktor = Math.max(0, 100 - activeSinceMin * 0.35);
  const stoppFaktor = Math.max(0, 100 - stops * 3.5);
  return Math.round((zeitFaktor * 0.6 + stoppFaktor * 0.4));
}

function calcPauseEmpfehlung(activeSinceMin: number, stops: number): PauseEmpfehlung {
  if (activeSinceMin >= 360) {
    return { typ: 'mahlzeit', label: 'Mahlzeitpause', in_min: 0, icon: '🍽️', urgency: 'jetzt' };
  }
  if (activeSinceMin >= 240) {
    return { typ: 'pause', label: 'Längere Pause', in_min: Math.max(0, 240 - (activeSinceMin % 240)), icon: '☕', urgency: activeSinceMin >= 270 ? 'jetzt' : 'bald' };
  }
  if (activeSinceMin >= 90 && stops >= 5) {
    return { typ: 'kurze-pause', label: '5-Min-Pause', in_min: Math.max(0, 120 - (activeSinceMin % 120)), icon: '💧', urgency: 'bald' };
  }
  const nextPause = Math.max(0, 90 - activeSinceMin);
  return { typ: 'weiter', label: 'Gut so!', in_min: nextPause, icon: '⚡', urgency: 'ok' };
}

const PLAN_ROWS = [
  { at_min: 90,  label: '5-Min-Pause empfohlen',   icon: '💧', farbe: 'text-blue-400'   },
  { at_min: 180, label: 'Kurze Ruhepause',          icon: '☕', farbe: 'text-amber-400'  },
  { at_min: 240, label: 'Längere Pause / Mahlzeit', icon: '🍽️', farbe: 'text-orange-400' },
  { at_min: 360, label: 'Schicht-Ende empfohlen',   icon: '🏁', farbe: 'text-red-400'    },
];

export function FahrerPhase882SchichtEnergieplan({ driverId, isOnline }: Props) {
  const [data, setData] = useState<ShiftData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = () => {
    if (!isOnline || !driverId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/schicht-effizienz?driver_id=${driverId}`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(d => {
        if (d?.shift_started_at) {
          const startedAt = new Date(d.shift_started_at);
          const activeSinceMin = Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 60_000));
          setData({
            shift_started_at: d.shift_started_at,
            total_stops_today: d.total_stops ?? 0,
            active_since_min: activeSinceMin,
          });
        } else {
          const activeSinceMin = Math.round((Date.now() - new Date(MOCK_SHIFT.shift_started_at!).getTime()) / 60_000);
          setData({ ...MOCK_SHIFT, active_since_min: Math.max(0, activeSinceMin) });
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 5 * 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, isOnline]);

  if (!isOnline || !data) return null;

  const energie = calcEnergieProzent(data.active_since_min, data.total_stops_today);
  const empfehlung = calcPauseEmpfehlung(data.active_since_min, data.total_stops_today);

  const energieFarbe =
    energie >= 70 ? 'text-matcha-400' : energie >= 40 ? 'text-amber-400' : 'text-red-400';
  const barFarbe =
    energie >= 70 ? 'bg-matcha-500' : energie >= 40 ? 'bg-amber-400' : 'bg-red-500';
  const urgencyRing =
    empfehlung.urgency === 'jetzt' ? 'ring-1 ring-red-500' :
    empfehlung.urgency === 'bald'  ? 'ring-1 ring-amber-400' : '';

  const schichtStunden = Math.floor(data.active_since_min / 60);
  const schichtMinuten = data.active_since_min % 60;

  return (
    <section className={cn('rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-4 space-y-3', urgencyRing)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Battery className="h-4 w-4 text-blue-300" />
        <span className="text-sm font-bold text-white">Schicht-Energieplan</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-blue-300 ml-auto" />}
      </div>

      {/* Energie-Balken */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-blue-300 font-semibold uppercase tracking-wider">Energie</span>
          <span className={cn('text-sm font-black tabular-nums', energieFarbe)}>{energie}%</span>
        </div>
        <div className="h-3 rounded-full bg-white/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-1000', barFarbe)}
            style={{ width: `${energie}%` }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-white/10 p-2 text-center">
          <Clock className="h-3 w-3 text-blue-300 mx-auto mb-0.5" />
          <div className="font-mono text-xs font-black text-white tabular-nums">
            {schichtStunden}h{schichtMinuten}m
          </div>
          <div className="text-[8px] text-blue-300">aktiv</div>
        </div>
        <div className="rounded-xl bg-white/10 p-2 text-center">
          <Zap className="h-3 w-3 text-amber-300 mx-auto mb-0.5" />
          <div className="text-xs font-black text-white tabular-nums">{data.total_stops_today}</div>
          <div className="text-[8px] text-blue-300">Stopps</div>
        </div>
        <div className="rounded-xl bg-white/10 p-2 text-center">
          <Coffee className="h-3 w-3 text-orange-300 mx-auto mb-0.5" />
          <div className="text-xs font-black text-white tabular-nums">
            {empfehlung.in_min > 0 ? `${empfehlung.in_min}m` : 'jetzt'}
          </div>
          <div className="text-[8px] text-blue-300">nächste Pause</div>
        </div>
      </div>

      {/* Aktuelle Empfehlung */}
      <div className={cn(
        'flex items-center gap-2.5 rounded-xl border px-3 py-2',
        empfehlung.urgency === 'jetzt' ? 'border-red-400/50 bg-red-500/20' :
        empfehlung.urgency === 'bald'  ? 'border-amber-400/50 bg-amber-500/20' :
                                          'border-matcha-400/30 bg-matcha-500/10',
      )}>
        <span className="text-lg">{empfehlung.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-white">{empfehlung.label}</div>
          <div className="text-[10px] text-blue-300">
            {empfehlung.urgency === 'jetzt'
              ? 'Empfehle jetzt Pause einzulegen'
              : empfehlung.in_min > 0
              ? `In ${empfehlung.in_min} Min empfohlen`
              : 'Du machst das super — weiter so!'
            }
          </div>
        </div>
        {empfehlung.urgency !== 'ok' && (
          <span className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black',
            empfehlung.urgency === 'jetzt' ? 'bg-red-500 text-white animate-pulse' : 'bg-amber-400 text-white',
          )}>
            {empfehlung.urgency === 'jetzt' ? 'JETZT' : 'BALD'}
          </span>
        )}
      </div>

      {/* Timeline */}
      <div className="space-y-1.5">
        <div className="text-[9px] font-bold uppercase tracking-wider text-blue-300">
          Schicht-Zeitplan
        </div>
        {PLAN_ROWS.map(row => {
          const reached = data.active_since_min >= row.at_min;
          const isCurrent =
            data.active_since_min < row.at_min &&
            data.active_since_min >= (PLAN_ROWS[PLAN_ROWS.indexOf(row) - 1]?.at_min ?? 0);
          return (
            <div
              key={row.at_min}
              className={cn(
                'flex items-center gap-2 rounded-lg px-2.5 py-1.5',
                reached ? 'opacity-40' : isCurrent ? 'bg-white/10' : 'opacity-60',
              )}
            >
              <span className="text-sm">{row.icon}</span>
              <div className="flex-1 min-w-0">
                <div className={cn('text-[10px] font-bold', row.farbe)}>{row.label}</div>
              </div>
              <span className="text-[9px] text-blue-300 tabular-nums shrink-0">
                {reached ? '✓' : `nach ${Math.floor(row.at_min / 60)}h${row.at_min % 60 > 0 ? String(row.at_min % 60) + 'm' : ''}`}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
