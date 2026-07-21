'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Clock, Package, Bike, CheckCircle2, ChevronRight } from 'lucide-react';

/**
 * Phase 2655 — Dynamische ETA Live-Tracking Ultra (Storefront)
 *
 * Live-Tracking-Widget für Kunden nach Bestellung:
 * ETA-Countdown + Phasen-Fortschritt (Bestellt/Zubereitung/Abgeholt/Unterwegs/Geliefert).
 * Dynamische ETA-Updates via Supabase Realtime oder 30-Sek-Polling.
 * Mobile-first, Matcha-Theme, deutsch.
 */

type OrderStatus = 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert' | 'storniert' | string;

interface Props {
  orderId?: string | null;
  bestellnummer?: string | null;
  status?: OrderStatus;
  etaMin?: number | null;
  erstellt_am?: string | null;
  fahrer?: { vorname?: string | null; nachname?: string | null } | null;
  compact?: boolean;
}

interface Phase {
  key: OrderStatus;
  label: string;
  icon: React.ElementType;
  desc: string;
}

const PHASES: Phase[] = [
  { key: 'bestätigt',     label: 'Bestätigt',    icon: CheckCircle2, desc: 'Deine Bestellung wurde angenommen' },
  { key: 'in_zubereitung',label: 'Zubereitung',  icon: Package,      desc: 'Die Küche bereitet dein Essen vor' },
  { key: 'fertig',        label: 'Bereit',        icon: Package,      desc: 'Bereit zur Abholung durch Fahrer' },
  { key: 'unterwegs',     label: 'Unterwegs',     icon: Bike,         desc: 'Dein Fahrer ist auf dem Weg' },
  { key: 'geliefert',     label: 'Geliefert',     icon: CheckCircle2, desc: 'Guten Appetit! 🎉' },
];

const STATUS_ORDER: Record<string, number> = {
  neu: 0, bestätigt: 1, in_zubereitung: 2, fertig: 3, unterwegs: 4, geliefert: 5,
};

function statusIndex(status: OrderStatus): number {
  return STATUS_ORDER[status] ?? 0;
}

function useCountdown(etaMin: number | null | undefined, erstellt_am: string | null | undefined) {
  const [sec, setSec] = useState<number | null>(null);

  useEffect(() => {
    if (!etaMin || !erstellt_am) { setSec(null); return; }
    const erstelltMs = new Date(erstellt_am).getTime();
    const targetMs = erstelltMs + etaMin * 60_000;

    const tick = () => {
      const remaining = Math.floor((targetMs - Date.now()) / 1000);
      setSec(remaining);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [etaMin, erstellt_am]);

  return sec;
}

function fmtRemain(sec: number): string {
  if (sec <= 0) return 'Jeden Moment';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m > 60) return `${Math.floor(m / 60)} Std ${m % 60} Min`;
  if (m > 0) return `${m} Min ${s} Sek`;
  return `${s} Sek`;
}

export function StorefrontPhase2655DynamischeEtaLiveTrackingUltra({
  status = 'bestätigt',
  etaMin,
  erstellt_am,
  bestellnummer,
  fahrer,
  compact = false,
}: Props) {
  const countdown = useCountdown(etaMin, erstellt_am);
  const currentIdx = useMemo(() => statusIndex(status), [status]);
  const isDelivered = status === 'geliefert';
  const isCancelled = status === 'storniert';

  if (isCancelled) {
    return (
      <div className="rounded-2xl border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-center">
        <div className="text-2xl mb-1">😔</div>
        <div className="font-bold text-sm text-red-700 dark:text-red-400">Bestellung storniert</div>
        {bestellnummer && <div className="text-[10px] text-muted-foreground mt-1">#{bestellnummer}</div>}
      </div>
    );
  }

  return (
    <div className={cn(
      'rounded-2xl border-2 overflow-hidden',
      isDelivered
        ? 'border-matcha-300 dark:border-matcha-700 bg-matcha-50 dark:bg-matcha-900/20'
        : 'border-blue-200 dark:border-blue-800 bg-white dark:bg-card',
    )}>
      {/* Header */}
      <div className={cn(
        'px-4 py-3 flex items-center gap-2',
        isDelivered ? 'bg-matcha-600 text-white' : 'bg-blue-600 text-white',
      )}>
        <MapPin className="h-4 w-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm">
            {isDelivered ? 'Geliefert! Guten Appetit 🎉' : 'Live-Tracking'}
          </div>
          {bestellnummer && (
            <div className="text-[10px] text-white/70">Bestellung #{bestellnummer}</div>
          )}
        </div>
        {!isDelivered && countdown != null && (
          <div className="text-right shrink-0">
            <div className="font-mono font-bold text-sm leading-none">
              {countdown > 0 ? fmtRemain(countdown) : 'Jeden Moment'}
            </div>
            <div className="text-[9px] text-white/70">ETA</div>
          </div>
        )}
      </div>

      {/* ETA Banner */}
      {!isDelivered && countdown != null && countdown > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 flex items-center gap-2 border-b border-blue-100 dark:border-blue-800">
          <Clock className="h-3.5 w-3.5 text-blue-600 shrink-0" />
          <span className="text-[11px] text-blue-700 dark:text-blue-300">
            Voraussichtliche Lieferzeit: <strong>{Math.ceil(countdown / 60)} Min</strong>
          </span>
        </div>
      )}

      {/* Fahrer-Info */}
      {status === 'unterwegs' && fahrer && (
        <div className="px-4 py-2 bg-violet-50 dark:bg-violet-900/20 border-b border-violet-100 dark:border-violet-800 flex items-center gap-2">
          <Bike className="h-3.5 w-3.5 text-violet-600 shrink-0" />
          <span className="text-[11px] text-violet-700 dark:text-violet-300">
            Fahrer: <strong>{fahrer.vorname} {fahrer.nachname}</strong>
          </span>
        </div>
      )}

      {/* Phase Fortschritt */}
      {!compact && (
        <div className="p-4">
          <div className="space-y-3">
            {PHASES.map((phase, idx) => {
              const done = idx < currentIdx;
              const active = idx === currentIdx || (isDelivered && idx === PHASES.length - 1);
              const Icon = phase.icon;
              return (
                <div key={phase.key} className="flex items-start gap-3">
                  <div className={cn(
                    'h-7 w-7 rounded-full flex items-center justify-center shrink-0 border-2 transition-all',
                    done
                      ? 'bg-matcha-500 border-matcha-600 text-white'
                      : active
                        ? 'bg-blue-500 border-blue-600 text-white scale-110 shadow-md'
                        : 'bg-muted/30 border-muted-foreground/20 text-muted-foreground/50',
                  )}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className={cn(
                      'font-semibold text-xs leading-none',
                      active ? 'text-blue-700 dark:text-blue-300' : done ? 'text-matcha-700 dark:text-matcha-400' : 'text-muted-foreground/50',
                    )}>
                      {phase.label}
                    </div>
                    {active && (
                      <div className="text-[9px] text-muted-foreground mt-0.5">{phase.desc}</div>
                    )}
                  </div>
                  {idx < PHASES.length - 1 && (
                    <ChevronRight className={cn(
                      'h-3.5 w-3.5 shrink-0 mt-0.5',
                      done ? 'text-matcha-400' : 'text-muted-foreground/20',
                    )} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Progress Bar */}
          <div className="mt-4 h-1.5 rounded-full bg-muted/30 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', isDelivered ? 'bg-matcha-500' : 'bg-blue-500')}
              style={{ width: `${Math.min(100, (currentIdx / (PHASES.length - 1)) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[8px] text-muted-foreground mt-0.5">
            <span>Bestellt</span>
            <span>Geliefert</span>
          </div>
        </div>
      )}

      {compact && (
        <div className="px-4 py-2 flex items-center gap-2">
          <div className="flex gap-1">
            {PHASES.map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  idx < currentIdx ? 'bg-matcha-500 w-4' :
                  idx === currentIdx ? 'bg-blue-500 w-4' : 'bg-muted/30 w-2',
                )}
              />
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground ml-1">
            {PHASES[currentIdx]?.label ?? 'Unbekannt'}
          </span>
        </div>
      )}
    </div>
  );
}
