'use client';

/**
 * EtaAmpel — Phase 165
 *
 * Kompakte ETA-Ampel (Verkehrsampel) für den aktuellen Stop in der Fahrer-App.
 * Zeigt auf einen Blick: Bin ich pünktlich?
 *
 * 🟢 Grün   = > 5 Min Puffer bis Lieferfenster-Ende
 * 🟡 Gelb   = 2–5 Min Puffer
 * 🔴 Rot    = < 2 Min Puffer / überfällig
 *
 * Unterschied zu EtaCountdown (in stop-nav-card.tsx, zeigt exakten Countdown):
 * → EtaAmpel ist ein schneller Status-Indikator, der auch ohne genaue
 *   ETA-Werte einen Annäherungswert auf Basis des Start-Zeitstempels zeigt.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Clock, Zap } from 'lucide-react';

type AmpelStatus = 'gruen' | 'gelb' | 'rot' | 'fertig' | 'unbekannt';

interface Props {
  etaLatest?: string | null;
  etaEarliest?: string | null;
  batchStartedAt?: string | null;
  totalEtaMin?: number | null;
  stopsTotal: number;
  stopsCompleted: number;
  className?: string;
}

const AMPEL_CONFIG: Record<AmpelStatus, {
  light: string;
  bg: string;
  border: string;
  label: string;
  subLabel: string;
  icon: React.ElementType;
}> = {
  gruen: {
    light: 'bg-green-500 shadow-[0_0_12px_4px_rgba(34,197,94,0.5)]',
    bg: 'bg-green-50',
    border: 'border-green-200',
    label: 'Pünktlich',
    subLabel: 'Im Zeitplan',
    icon: CheckCircle2,
  },
  gelb: {
    light: 'bg-amber-400 shadow-[0_0_12px_4px_rgba(245,158,11,0.45)] animate-pulse',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    label: 'Knapp',
    subLabel: 'Bitte beeilen',
    icon: Clock,
  },
  rot: {
    light: 'bg-red-500 shadow-[0_0_16px_6px_rgba(239,68,68,0.5)] animate-pulse',
    bg: 'bg-red-50',
    border: 'border-red-200',
    label: 'Verspätet',
    subLabel: 'Lieferfenster überschritten',
    icon: AlertTriangle,
  },
  fertig: {
    light: 'bg-matcha-500',
    bg: 'bg-matcha-50',
    border: 'border-matcha-200',
    label: 'Alle erledigt',
    subLabel: 'Tour abgeschlossen',
    icon: CheckCircle2,
  },
  unbekannt: {
    light: 'bg-zinc-400',
    bg: 'bg-zinc-50',
    border: 'border-zinc-200',
    label: 'Unterwegs',
    subLabel: 'Kein ETA verfügbar',
    icon: Zap,
  },
};

function useAmpelStatus(
  etaLatest: string | null | undefined,
  etaEarliest: string | null | undefined,
  batchStartedAt: string | null | undefined,
  totalEtaMin: number | null | undefined,
  stopsCompleted: number,
  stopsTotal: number,
): AmpelStatus {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 10_000);
    return () => clearInterval(iv);
  }, []);

  if (stopsCompleted >= stopsTotal && stopsTotal > 0) return 'fertig';

  const now = Date.now();

  if (etaLatest) {
    const secToEnd = (new Date(etaLatest).getTime() - now) / 1000;
    if (secToEnd < 0) return 'rot';
    if (secToEnd < 2 * 60) return 'rot';
    if (secToEnd < 5 * 60) return 'gelb';
    return 'gruen';
  }

  if (batchStartedAt && totalEtaMin != null) {
    const etaMs = new Date(batchStartedAt).getTime() + totalEtaMin * 60_000;
    const secToEta = (etaMs - now) / 1000;
    if (secToEta < 0) return 'rot';
    if (secToEta < 3 * 60) return 'gelb';
    return 'gruen';
  }

  return 'unbekannt';
}

export function EtaAmpel({
  etaLatest,
  etaEarliest,
  batchStartedAt,
  totalEtaMin,
  stopsTotal,
  stopsCompleted,
  className,
}: Props) {
  const status = useAmpelStatus(etaLatest, etaEarliest, batchStartedAt, totalEtaMin, stopsCompleted, stopsTotal);
  const config = AMPEL_CONFIG[status];
  const Icon = config.icon;

  const pct = stopsTotal > 0 ? (stopsCompleted / stopsTotal) * 100 : 0;

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-2xl border px-4 py-3',
      config.bg, config.border,
      className,
    )}>
      {/* Ampel-Licht */}
      <div className="relative flex-shrink-0 flex flex-col items-center justify-center gap-1 w-8">
        {/* Drei Kreise (Verkehrsampel-Stil) */}
        <div className={cn('h-3 w-3 rounded-full', status === 'rot' ? config.light : 'bg-black/10')} />
        <div className={cn('h-3 w-3 rounded-full', status === 'gelb' ? config.light : 'bg-black/10')} />
        <div className={cn('h-3 w-3 rounded-full', (status === 'gruen' || status === 'fertig') ? config.light : 'bg-black/10')} />
      </div>

      {/* Status */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Icon className={cn('h-4 w-4 shrink-0', {
            'text-green-600': status === 'gruen' || status === 'fertig',
            'text-amber-600': status === 'gelb',
            'text-red-600': status === 'rot',
            'text-zinc-500': status === 'unbekannt',
          })} />
          <span className={cn('text-sm font-black', {
            'text-green-700': status === 'gruen' || status === 'fertig',
            'text-amber-700': status === 'gelb',
            'text-red-700': status === 'rot',
            'text-zinc-600': status === 'unbekannt',
          })}>
            {config.label}
          </span>
        </div>
        <div className="text-[10px] text-black/50 font-semibold mt-0.5">
          {config.subLabel}
        </div>
      </div>

      {/* Stops Fortschritt */}
      {stopsTotal > 0 && (
        <div className="text-right flex-shrink-0">
          <div className="flex items-center gap-1 justify-end">
            {/* Mini Fortschrittsbalken */}
            <div className="w-16 h-1.5 rounded-full bg-black/10 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  status === 'rot' ? 'bg-red-500' :
                  status === 'gelb' ? 'bg-amber-500' :
                  'bg-green-500',
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <div className="text-[10px] font-bold text-black/50 mt-0.5 tabular-nums">
            {stopsCompleted}/{stopsTotal} Stops
          </div>
        </div>
      )}
    </div>
  );
}
