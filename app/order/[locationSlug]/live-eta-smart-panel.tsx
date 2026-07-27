'use client';

import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Bike, CheckCircle2, ChefHat, Package } from 'lucide-react';

interface Props {
  orderId: string;
  initialEtaMin?: number | null;
  status?: string | null;
  className?: string;
}

type DeliveryPhase = 'bestaetigt' | 'zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

const PHASE_CONFIG: Record<DeliveryPhase, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  bestaetigt:  { label: 'Bestätigt',       icon: CheckCircle2, color: 'text-emerald-600' },
  zubereitung: { label: 'Wird zubereitet', icon: ChefHat,      color: 'text-orange-500' },
  fertig:      { label: 'Fertig',          icon: Package,      color: 'text-blue-500' },
  unterwegs:   { label: 'Unterwegs',       icon: Bike,         color: 'text-blue-600' },
  geliefert:   { label: 'Geliefert!',      icon: CheckCircle2, color: 'text-emerald-600' },
};

const STATUS_TO_PHASE: Record<string, DeliveryPhase> = {
  neu:             'bestaetigt',
  bestätigt:       'bestaetigt',
  in_zubereitung:  'zubereitung',
  fertig:          'fertig',
  unterwegs:       'unterwegs',
  geliefert:       'geliefert',
};

const PHASES: DeliveryPhase[] = ['bestaetigt', 'zubereitung', 'fertig', 'unterwegs', 'geliefert'];

function useCountdown(targetSec: number | null) {
  const [remaining, setRemaining] = useState(targetSec);
  const ref = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setRemaining(targetSec);
    if (targetSec == null || targetSec <= 0) return;
    ref.current = setInterval(() => {
      setRemaining(r => (r != null && r > 0 ? r - 1 : 0));
    }, 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [targetSec]);

  return remaining;
}

function formatRemaining(sec: number | null): string {
  if (sec == null) return '—';
  if (sec <= 0) return 'Jeden Moment…';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 2) return `ca. ${m} Min`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function LiveEtaSmartPanel({ orderId, initialEtaMin, status, className }: Props) {
  const [etaMin, setEtaMin] = useState(initialEtaMin ?? null);
  const [currentStatus, setCurrentStatus] = useState(status ?? 'bestätigt');
  const [lastPoll, setLastPoll] = useState(Date.now());

  const phase = STATUS_TO_PHASE[currentStatus] ?? 'bestaetigt';
  const phaseIndex = PHASES.indexOf(phase);
  const remainingSec = useCountdown(etaMin != null ? etaMin * 60 : null);

  // Poll for updates every 30 seconds
  useEffect(() => {
    if (!orderId) return;
    const poll = async () => {
      try {
        const r = await fetch(`/api/delivery/customer/tracking?order_id=${orderId}`);
        if (!r.ok) return;
        const data = await r.json();
        if (data.status) setCurrentStatus(data.status);
        if (data.eta_min != null) setEtaMin(data.eta_min);
        setLastPoll(Date.now());
      } catch {}
    };
    const iv = setInterval(poll, 30_000);
    return () => clearInterval(iv);
  }, [orderId]);

  const phaseConf = PHASE_CONFIG[phase];
  const PhaseIcon = phaseConf.icon;
  const isDelivered = phase === 'geliefert';

  return (
    <div className={cn('rounded-2xl border bg-card overflow-hidden', className)}>
      {/* ETA display */}
      {!isDelivered && (
        <div className="bg-gradient-to-br from-matcha-600 to-matcha-700 px-5 py-4 text-white text-center">
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">Lieferzeit</div>
          <div className="text-4xl font-black tabular-nums leading-none">
            {formatRemaining(remainingSec)}
          </div>
          {etaMin != null && remainingSec != null && remainingSec > 120 && (
            <div className="text-[11px] opacity-70 mt-1">~{Math.round(remainingSec / 60)} Minuten</div>
          )}
        </div>
      )}

      {isDelivered && (
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 px-5 py-4 text-white text-center">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-1" />
          <div className="text-lg font-black">Zugestellt!</div>
          <div className="text-[11px] opacity-80">Guten Appetit!</div>
        </div>
      )}

      {/* Phase stepper */}
      <div className="px-4 py-3">
        <div className="relative flex items-center justify-between">
          {/* Progress line */}
          <div className="absolute left-0 right-0 top-3 h-0.5 bg-muted" />
          <div
            className="absolute left-0 top-3 h-0.5 bg-matcha-500 transition-all duration-700"
            style={{ right: `${((PHASES.length - 1 - phaseIndex) / (PHASES.length - 1)) * 100}%` }}
          />

          {PHASES.map((p, i) => {
            const conf = PHASE_CONFIG[p];
            const Icon = conf.icon;
            const done = i < phaseIndex;
            const active = i === phaseIndex;

            return (
              <div key={p} className="relative z-10 flex flex-col items-center gap-1">
                <div className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all',
                  done   ? 'border-matcha-500 bg-matcha-500'        : '',
                  active ? 'border-matcha-500 bg-white dark:bg-card' : '',
                  !done && !active ? 'border-muted bg-card'          : '',
                )}>
                  {done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                  ) : (
                    <Icon className={cn('h-3 w-3', active ? conf.color : 'text-muted-foreground')} />
                  )}
                </div>
                <span className={cn(
                  'text-[8px] font-medium leading-tight text-center max-w-[40px]',
                  active ? 'text-foreground font-bold' : 'text-muted-foreground',
                )}>
                  {conf.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status info */}
      <div className="border-t px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <PhaseIcon className={cn('h-3.5 w-3.5', phaseConf.color)} />
          <span className="text-xs font-medium">{phaseConf.label}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Live</span>
        </div>
      </div>
    </div>
  );
}
