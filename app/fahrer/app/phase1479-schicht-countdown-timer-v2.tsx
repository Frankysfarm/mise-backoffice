'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Timer, Clock, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';

// Phase 1479 — Schicht-Countdown-Timer v2 (Fahrer-App)
// Restliche Schichtzeit (lokal berechnet) + ETA letzter Stopp aus API
// + ob weitere Tour sinnvoll. isOnline-Guard. 1-Min-Interval + 10-Min-API-Polling.
// Nach Phase 1474.

interface Props {
  driverId: string;
  isOnline: boolean;
  locationId: string | null;
  schichtStart?: string | null;
  schichtDauerStunden?: number;
}

interface PrognoseData {
  minuten_bis_schichtende: number;
  offene_stopps: number;
  noch_eine_tour_sinnvoll: boolean;
  empfehlung: string;
}

const SHIFT_HOURS_DEFAULT = 8;

function calcRestzeit(schichtStart: string | null, dauerH: number): number {
  if (!schichtStart) return dauerH * 60;
  const startMs = new Date(schichtStart).getTime();
  const endeMs = startMs + dauerH * 60 * 60_000;
  const restMs = endeMs - Date.now();
  return Math.max(0, Math.round(restMs / 60_000));
}

function formatDuration(min: number): string {
  if (min <= 0) return '00:00';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function FahrerPhase1479SchichtCountdownTimerV2({
  driverId,
  isOnline,
  locationId,
  schichtStart,
  schichtDauerStunden,
}: Props) {
  const dauerH = schichtDauerStunden ?? SHIFT_HOURS_DEFAULT;

  const [restMin, setRestMin] = useState(() => calcRestzeit(schichtStart ?? null, dauerH));
  const [prognose, setPrognose] = useState<PrognoseData | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // 1-min interval for local countdown
  useEffect(() => {
    setRestMin(calcRestzeit(schichtStart ?? null, dauerH));
    const iv = setInterval(() => {
      setRestMin(calcRestzeit(schichtStart ?? null, dauerH));
    }, 60_000);
    return () => clearInterval(iv);
  }, [schichtStart, dauerH]);

  // 10-min API polling for prognose
  useEffect(() => {
    if (!isOnline || !locationId) return;

    async function fetchPrognose() {
      try {
        const res = await fetch(
          `/api/delivery/admin/schicht-ende-prognose?location_id=${locationId}`,
          { cache: 'no-store' },
        );
        if (res.ok) {
          const json = await res.json();
          if (json?.minuten_bis_schichtende != null) setPrognose(json as PrognoseData);
        }
      } catch {
        // keep null
      }
    }

    fetchPrognose();
    const iv = setInterval(fetchPrognose, 10 * 60_000);
    return () => clearInterval(iv);
  }, [driverId, isOnline, locationId]);

  if (!mounted || !isOnline) return null;

  const isKritisch = restMin <= 20 && restMin > 0;
  const isDone = restMin <= 0;

  const bgCls = isDone
    ? 'bg-emerald-900/80 border-emerald-700/60'
    : isKritisch
    ? 'bg-rose-900/80 border-rose-700/60'
    : 'bg-slate-800/90 border-slate-700/60';

  const Icon = isDone ? CheckCircle2 : isKritisch ? AlertTriangle : Timer;
  const mainColor = isDone ? 'text-emerald-400' : isKritisch ? 'text-rose-400' : 'text-sky-300';

  // Fill ratio for the arc
  const totalMin = dauerH * 60;
  const fillRatio = totalMin > 0 ? Math.min(1, Math.max(0, 1 - restMin / totalMin)) : 1;
  const SIZE = 88;
  const STROKE = 8;
  const R = (SIZE - STROKE) / 2;
  const CIRC = 2 * Math.PI * R;
  const dashOffset = CIRC * (1 - fillRatio);

  return (
    <section className={cn('rounded-2xl border p-4 space-y-3', bgCls)}>
      <div className="flex items-center gap-2">
        <Icon className={cn('h-5 w-5 shrink-0', mainColor)} />
        <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider">Schicht-Timer</span>
        <Clock className="ml-auto h-3.5 w-3.5 text-white/40" />
      </div>

      <div className="flex items-center gap-4">
        {/* SVG ring */}
        <div className="relative shrink-0">
          <svg width={SIZE} height={SIZE} className="-rotate-90">
            <circle
              cx={SIZE / 2} cy={SIZE / 2} r={R}
              fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={STROKE}
            />
            <circle
              cx={SIZE / 2} cy={SIZE / 2} r={R}
              fill="none" strokeWidth={STROKE} strokeLinecap="round"
              strokeDasharray={CIRC} strokeDashoffset={dashOffset}
              className={isDone ? 'stroke-emerald-400' : isKritisch ? 'stroke-rose-400' : 'stroke-sky-400'}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('text-base font-black tabular-nums leading-tight', mainColor)}>
              {formatDuration(restMin)}
            </span>
            <span className="text-[8px] text-white/40 uppercase tracking-wide">Rest</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 space-y-2">
          <div>
            <div className="text-[9px] text-white/40 uppercase tracking-wide">Schicht-Ende</div>
            {schichtStart ? (
              <div className="text-sm font-semibold text-white">
                {new Date(
                  new Date(schichtStart).getTime() + dauerH * 60 * 60_000,
                ).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
              </div>
            ) : (
              <div className="text-sm text-white/50">—</div>
            )}
          </div>
          {isDone ? (
            <div className="text-xs font-bold text-emerald-400">✓ Schichtzeit abgelaufen</div>
          ) : (
            <div className={cn('text-xs font-bold', isKritisch ? 'text-rose-300' : 'text-white/70')}>
              {isKritisch ? '⚠ Schichtende naht' : `Noch ${restMin} Min verbleibend`}
            </div>
          )}
        </div>
      </div>

      {/* API prognose */}
      {prognose && (
        <div className="border-t border-white/10 pt-3 space-y-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-white/50 shrink-0" />
            <span className="text-[10px] text-white/50 uppercase tracking-wide">Tour-Prognose</span>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <div className="text-[9px] text-white/40">Offene Stopps</div>
              <div className="text-lg font-black tabular-nums text-white">{prognose.offene_stopps}</div>
            </div>
            <div>
              <div className="text-[9px] text-white/40">Weitere Tour?</div>
              <div className={cn('text-sm font-bold', prognose.noch_eine_tour_sinnvoll ? 'text-emerald-400' : 'text-rose-400')}>
                {prognose.noch_eine_tour_sinnvoll ? '✓ Ja' : '✗ Nein'}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-white/60 leading-relaxed">{prognose.empfehlung}</p>
        </div>
      )}
    </section>
  );
}
