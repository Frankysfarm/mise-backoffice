'use client';

import { useEffect, useState } from 'react';
import { Clock, Zap, Navigation2, ChefHat, Package, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  status: string;
  etaEarliest: string | null;
  etaLatest: string | null;
  createdAt: string;
}

function secondsUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}

function fmtMmSs(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function progressColor(pct: number, isLate: boolean) {
  if (isLate) return 'from-amber-400 to-amber-500';
  if (pct >= 80) return 'from-green-400 to-green-500';
  if (pct >= 50) return 'from-matcha-400 to-matcha-500';
  return 'from-blue-400 to-blue-500';
}

const STATUS_PHASES: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  neu:              { label: 'Bestellung eingegangen',     icon: Package,       color: 'text-blue-500'     },
  bestätigt:       { label: 'Restaurant hat bestätigt',   icon: CheckCircle2,  color: 'text-matcha-500'   },
  in_zubereitung:  { label: 'Wird zubereitet',            icon: ChefHat,       color: 'text-orange-500'   },
  fertig:          { label: 'Bereit zur Abholung',         icon: Package,       color: 'text-matcha-600'   },
  abgeholt:        { label: 'Fahrer hat abgeholt',         icon: Navigation2,   color: 'text-blue-600'     },
  unterwegs:       { label: 'Fahrer ist unterwegs',        icon: Navigation2,   color: 'text-green-600'    },
  geliefert:       { label: 'Erfolgreich geliefert!',      icon: CheckCircle2,  color: 'text-green-700'    },
  storniert:       { label: 'Bestellung storniert',        icon: AlertCircle,   color: 'text-red-500'      },
};

export function Phase4460DynamischeEtaLivePanel({ status, etaEarliest, etaLatest, createdAt }: Props) {
  const [secRemain, setSecRemain] = useState<number | null>(() => secondsUntil(etaEarliest));
  const [pct, setPct] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const sr = secondsUntil(etaEarliest);
    setSecRemain(sr);

    if (etaEarliest && createdAt) {
      const totalMs  = new Date(etaEarliest).getTime() - new Date(createdAt).getTime();
      const elapsedMs = Date.now() - new Date(createdAt).getTime();
      const p = totalMs > 0 ? Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100))) : 0;
      setPct(p);
    }
  }, [etaEarliest, createdAt, tick]);

  const isDelivered  = status === 'geliefert';
  const isCancelled  = status === 'storniert';
  const isLate       = pct >= 100 && !isDelivered && !isCancelled;
  const isCountdown  = secRemain !== null && secRemain <= 15 * 60 && !isDelivered && !isCancelled;
  const phaseInfo    = STATUS_PHASES[status] ?? STATUS_PHASES.neu;
  const StatusIcon   = phaseInfo.icon;

  const formatEtaWindow = () => {
    if (!etaEarliest) return 'Wird berechnet…';
    const e = new Date(etaEarliest);
    const l = etaLatest ? new Date(etaLatest) : null;
    const fmt = (d: Date) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    return l ? `${fmt(e)} – ${fmt(l)} Uhr` : `${fmt(e)} Uhr`;
  };

  if (isCancelled) return null;

  return (
    <div className={cn(
      'rounded-2xl border p-4 space-y-3 shadow-sm',
      isDelivered
        ? 'bg-green-50 border-green-200'
        : isLate
          ? 'bg-amber-50 border-amber-200 animate-pulse'
          : 'bg-white border-matcha-100'
    )}>
      {/* Status + Live badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon className={cn('h-4 w-4', phaseInfo.color)} />
          <span className={cn('text-sm font-semibold', phaseInfo.color)}>{phaseInfo.label}</span>
        </div>
        {!isDelivered && (
          <div className="flex items-center gap-1 text-[10px] font-semibold text-matcha-500 bg-matcha-50 border border-matcha-200 rounded-full px-2 py-0.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-matcha-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-matcha-500" />
            </span>
            Live
          </div>
        )}
      </div>

      {/* Countdown or ETA window */}
      {!isDelivered && (
        <div className="text-center py-1">
          {isCountdown && secRemain !== null ? (
            <div>
              <div className={cn(
                'font-mono text-4xl font-black tabular-nums',
                secRemain <= 60 ? 'text-amber-500 animate-pulse' : 'text-matcha-800',
              )}>
                {fmtMmSs(secRemain)}
              </div>
              <div className="flex items-center justify-center gap-1 mt-1 text-xs text-matcha-500">
                <Zap className="h-3.5 w-3.5 text-yellow-400" />
                Echtzeit-Countdown
              </div>
            </div>
          ) : isLate ? (
            <div className="text-lg font-bold text-amber-700">Gleich da! 🛵</div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-matcha-700">
              <Clock className="h-4 w-4 text-matcha-500" />
              <span className="text-base font-semibold">{formatEtaWindow()}</span>
            </div>
          )}
        </div>
      )}

      {isDelivered && (
        <div className="text-center text-green-700 font-bold text-lg">✅ Genuss beginnt jetzt!</div>
      )}

      {/* Progress bar */}
      {!isDelivered && etaEarliest && (
        <div>
          <div className="flex justify-between text-[10px] text-matcha-400 mb-1">
            <span>Bestellung</span>
            <span className={cn(isLate ? 'text-amber-500 font-semibold' : 'text-matcha-400')}>
              {isLate ? '100% — fast da!' : `${pct}%`}
            </span>
            <span>Ankunft</span>
          </div>
          <div className="h-3 rounded-full bg-matcha-100 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full bg-gradient-to-r transition-all duration-1000',
                progressColor(pct, isLate),
              )}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
