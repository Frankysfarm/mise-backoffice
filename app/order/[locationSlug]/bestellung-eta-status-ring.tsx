'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { CheckCircle2, ChefHat, Bike, Package, Clock } from 'lucide-react';

interface Props {
  orderId: string;
  initialStatus: string;
  initialEtaMin?: number;
  onStatusChange?: (status: string) => void;
}

type Phase = 'bestellt' | 'angenommen' | 'zubereitung' | 'unterwegs' | 'geliefert';

const STATUS_TO_PHASE: Record<string, Phase> = {
  neu:           'bestellt',
  bestätigt:     'angenommen',
  in_zubereitung:'zubereitung',
  fertig:        'zubereitung',
  assigned:      'unterwegs',
  unterwegs:     'unterwegs',
  geliefert:     'geliefert',
  abgeholt:      'geliefert',
  abgeschlossen: 'geliefert',
};

const PHASES: { key: Phase; label: string; icon: React.ElementType }[] = [
  { key: 'bestellt',    label: 'Bestellt',     icon: Package },
  { key: 'angenommen',  label: 'Angenommen',   icon: CheckCircle2 },
  { key: 'zubereitung', label: 'In Zubereitung', icon: ChefHat },
  { key: 'unterwegs',   label: 'Unterwegs',    icon: Bike },
  { key: 'geliefert',   label: 'Angekommen',   icon: CheckCircle2 },
];

function getPhaseIndex(phase: Phase): number {
  return PHASES.findIndex(p => p.key === phase);
}

function CircleRing({
  pct,
  size = 120,
  stroke = 8,
  color,
  pulse,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color: string;
  pulse?: boolean;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  return (
    <svg width={size} height={size} className={cn('rotate-[-90deg]', pulse && 'animate-pulse')}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-muted/30" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
    </svg>
  );
}

export function BestellungEtaStatusRing({ orderId, initialStatus, initialEtaMin, onStatusChange }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [etaMin, setEtaMin] = useState(initialEtaMin ?? null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [startTime] = useState(Date.now());

  const phase = STATUS_TO_PHASE[status] ?? 'bestellt';
  const phaseIdx = getPhaseIndex(phase);
  const totalMin = etaMin ?? 30;
  const pct = Math.min(1, elapsedSec / (totalMin * 60));
  const remainMin = Math.max(0, Math.round(totalMin - elapsedSec / 60));
  const isDone = phase === 'geliefert';

  // Tick
  useEffect(() => {
    if (isDone) return;
    const iv = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [isDone, startTime]);

  // Realtime status subscription
  useEffect(() => {
    const sb = createClient();
    const ch = sb
      .channel(`order-eta-ring-${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'customer_orders',
        filter: `id=eq.${orderId}`,
      }, (payload: { new: { status?: string; geschaetzte_lieferung_min?: number | null } }) => {
        const newStatus = payload.new.status;
        if (newStatus) {
          setStatus(newStatus);
          onStatusChange?.(newStatus);
        }
        if (payload.new.geschaetzte_lieferung_min != null) {
          setEtaMin(payload.new.geschaetzte_lieferung_min);
        }
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [orderId, onStatusChange]);

  const ringColor = isDone
    ? '#22c55e'
    : pct > 0.9
    ? '#ef4444'
    : pct > 0.7
    ? '#f59e0b'
    : '#6B9F6F'; // matcha-600

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {/* Ring */}
      <div className="relative">
        <CircleRing pct={isDone ? 1 : pct} color={ringColor} size={120} stroke={8} pulse={!isDone && pct < 0.1} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isDone ? (
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          ) : (
            <>
              <span className="text-2xl font-black tabular-nums text-foreground">{remainMin}</span>
              <span className="text-[10px] text-muted-foreground">Min</span>
            </>
          )}
        </div>
      </div>

      {/* Phase stepper */}
      <div className="flex items-center gap-1">
        {PHASES.map((p, i) => {
          const isActive = i === phaseIdx;
          const isDonePhase = i < phaseIdx || isDone;
          const Icon = p.icon;
          return (
            <div key={p.key} className="flex items-center gap-1">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full transition-all duration-300',
                  isDonePhase
                    ? 'bg-matcha-500 text-white'
                    : isActive
                    ? 'bg-matcha-100 text-matcha-700 ring-2 ring-matcha-400'
                    : 'bg-muted text-muted-foreground/50',
                )}
              >
                <Icon className="h-3 w-3" />
              </div>
              {i < PHASES.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 w-4 rounded-full transition-all duration-300',
                    i < phaseIdx ? 'bg-matcha-500' : 'bg-muted',
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Current phase label */}
      <div className="text-center">
        <div className="text-sm font-bold text-foreground">
          {isDone ? 'Deine Bestellung ist da!' : PHASES[phaseIdx]?.label}
        </div>
        {!isDone && etaMin != null && (
          <div className="mt-0.5 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            Geschätzte Ankunft: ~{remainMin} Min
          </div>
        )}
      </div>
    </div>
  );
}
