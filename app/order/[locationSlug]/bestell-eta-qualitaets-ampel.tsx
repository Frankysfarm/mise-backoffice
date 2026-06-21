'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, Loader2, Truck, Zap } from 'lucide-react';

type EtaQualityLevel = 'high' | 'medium' | 'low';

interface Props {
  orderId: string;
  etaEarliest: string | null;
  etaLatest: string | null;
  status: string;
}

function getRemainingMin(isoStr: string | null): number | null {
  if (!isoStr) return null;
  const diff = new Date(isoStr).getTime() - Date.now();
  return Math.round(diff / 60_000);
}

function getQualityLevel(windowMin: number): EtaQualityLevel {
  if (windowMin <= 10) return 'high';
  if (windowMin <= 20) return 'medium';
  return 'low';
}

const QUALITY_CONFIG: Record<EtaQualityLevel, {
  label: string;
  sublabel: string;
  dotColor: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  pulseColor: string;
}> = {
  high: {
    label: 'Präzise ETA',
    sublabel: 'Sehr genaue Zeitangabe',
    dotColor: 'bg-matcha-500',
    textColor: 'text-matcha-700',
    bgColor: 'bg-matcha-50',
    borderColor: 'border-matcha-200',
    pulseColor: 'bg-matcha-400',
  },
  medium: {
    label: 'Ungefähre ETA',
    sublabel: 'Kleine Schwankungen möglich',
    dotColor: 'bg-amber-500',
    textColor: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    pulseColor: 'bg-amber-400',
  },
  low: {
    label: 'Offene ETA',
    sublabel: 'Mehrere Faktoren aktiv',
    dotColor: 'bg-blue-500',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    pulseColor: 'bg-blue-400',
  },
};

const STATUS_DONE = ['geliefert', 'abgeholt', 'storniert'];
const STATUS_LABELS: Record<string, string> = {
  neu: 'Bestätigung ausstehend',
  bestätigt: 'Bestellung angenommen',
  in_zubereitung: 'Wird zubereitet',
  fertig: 'Fertig — Fahrer kommt',
  unterwegs: 'Fahrer unterwegs',
  geliefert: 'Zugestellt ✓',
  abgeholt: 'Abgeholt ✓',
};

export function BestellEtaQualitaetsAmpel({ orderId, etaEarliest, etaLatest, status }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (STATUS_DONE.includes(status)) return;
    const iv = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(iv);
  }, [status]);

  if (STATUS_DONE.includes(status)) return null;
  if (!etaEarliest && !etaLatest) return null;

  const earliestMin = getRemainingMin(etaEarliest);
  const latestMin = getRemainingMin(etaLatest);

  if (earliestMin !== null && earliestMin < -30) return null;

  const windowMin = earliestMin !== null && latestMin !== null
    ? Math.max(0, latestMin - earliestMin)
    : 20;

  const quality = getQualityLevel(windowMin);
  const cfg = QUALITY_CONFIG[quality];

  const displayMin = earliestMin !== null
    ? Math.max(1, earliestMin)
    : latestMin !== null ? Math.max(1, latestMin) : null;

  const isOnWay = status === 'unterwegs';
  const isReady = status === 'fertig';

  return (
    <div className={cn('rounded-2xl border p-4', cfg.bgColor, cfg.borderColor)}>
      <div className="flex items-center justify-between">
        {/* Left: status + ETA */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Live dot */}
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
            <div className={cn('absolute inset-0 rounded-full opacity-30 animate-ping', cfg.pulseColor)} />
            <div className={cn('relative z-10 flex h-6 w-6 items-center justify-center rounded-full', cfg.dotColor)}>
              {isOnWay ? (
                <Truck className="h-3 w-3 text-white" />
              ) : isReady ? (
                <CheckCircle2 className="h-3 w-3 text-white" />
              ) : (
                <Clock className="h-3 w-3 text-white" />
              )}
            </div>
          </div>

          <div className="min-w-0">
            <div className={cn('text-xs font-bold truncate', cfg.textColor)}>
              {STATUS_LABELS[status] ?? status}
            </div>
            {displayMin !== null && (
              <div className="text-[11px] text-stone-500 tabular-nums">
                {isOnWay && earliestMin !== null && latestMin !== null
                  ? `Ankunft in ${displayMin}–${latestMin} Min`
                  : `ca. ${displayMin} Min`}
              </div>
            )}
          </div>
        </div>

        {/* Right: quality indicator */}
        <div className="shrink-0 text-right ml-3">
          <div className={cn('text-[10px] font-bold', cfg.textColor)}>{cfg.label}</div>
          <div className="text-[9px] text-stone-400">{cfg.sublabel}</div>
        </div>
      </div>

      {/* Window bar */}
      {etaEarliest && etaLatest && windowMin > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-[9px] text-stone-400 mb-1">
            <span>Frühestens</span>
            <span>Spätestens</span>
          </div>
          <div className="relative h-2 rounded-full bg-stone-200 overflow-hidden">
            <div
              className={cn('absolute left-0 h-full rounded-full transition-all duration-1000', cfg.dotColor)}
              style={{
                left: `${Math.max(0, Math.min(80, (1 - (windowMin / 30)) * 80))}%`,
                width: `${Math.min(100, (windowMin / 30) * 40 + 10)}%`,
                maxWidth: '100%',
              }}
            />
          </div>
          <div className="mt-1 text-[9px] text-center text-stone-400">
            ±{Math.round(windowMin / 2)} Min Genauigkeitsfenster
          </div>
        </div>
      )}

      {/* "Powered by" hint */}
      <div className="mt-2 flex items-center gap-1 justify-end">
        <Zap className="h-2.5 w-2.5 text-stone-300" />
        <span className="text-[8px] text-stone-300">Live-ETA · mise Smart Delivery</span>
      </div>
    </div>
  );
}
