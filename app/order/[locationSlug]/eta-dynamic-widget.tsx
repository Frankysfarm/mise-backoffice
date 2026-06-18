'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  orderId: string;
  initialEtaMin?: number | null;
  initialStatus?: string | null;
}

type PhaseKey = 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

const PHASE_PROGRESS: Record<string, number> = {
  neu: 10,
  bestätigt: 20,
  angenommen: 20,
  in_zubereitung: 40,
  preparing: 40,
  fertig: 70,
  ready: 70,
  unterwegs: 90,
  out_for_delivery: 90,
  picked_up: 90,
  geliefert: 100,
  delivered: 100,
  completed: 100,
};

const PHASE_LABEL: Record<string, string> = {
  neu: 'Bestellung eingegangen',
  bestätigt: 'Bestellung angenommen',
  angenommen: 'Bestellung angenommen',
  in_zubereitung: 'Wird zubereitet',
  preparing: 'Wird zubereitet',
  fertig: 'Fertig zur Abholung',
  ready: 'Fertig zur Abholung',
  unterwegs: 'Gerade unterwegs',
  out_for_delivery: 'Gerade unterwegs',
  picked_up: 'Gerade unterwegs',
  geliefert: 'Geliefert!',
  delivered: 'Geliefert!',
  completed: 'Geliefert!',
};

function progressColor(pct: number): string {
  if (pct >= 100) return 'bg-emerald-500';
  if (pct >= 70) return 'bg-matcha-500';
  if (pct >= 40) return 'bg-amber-400';
  return 'bg-matcha-400';
}

export function EtaDynamicWidget({ orderId, initialEtaMin, initialStatus }: Props) {
  const [etaMin, setEtaMin] = useState<number | null>(initialEtaMin ?? null);
  const [status, setStatus] = useState<string | null>(initialStatus ?? null);
  const [error, setError] = useState(false);
  const [ticking, setTicking] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    let mounted = true;

    async function poll() {
      try {
        const res = await fetch(`/api/delivery/eta/${orderId}`);
        if (!mounted) return;
        if (!res.ok) { setError(true); return; }
        setError(false);
        const data = await res.json();
        if (data?.eta_min != null) setEtaMin(data.eta_min);
        if (data?.status) setStatus(data.status);
      } catch {
        if (mounted) setError(true);
      }
    }

    poll();
    const iv = setInterval(poll, 30_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [orderId]);

  // Local 1-min countdown
  useEffect(() => {
    if (etaMin == null || etaMin <= 0) return;
    const iv = setInterval(() => {
      setEtaMin((p) => (p != null && p > 0 ? p - 1 : p));
      setTicking((t) => !t);
    }, 60_000);
    return () => clearInterval(iv);
  }, [etaMin]);

  const pct = PHASE_PROGRESS[status ?? ''] ?? 10;
  const phaseLabel = PHASE_LABEL[status ?? ''] ?? 'Bestellung eingegangen';
  const isDelivered = pct >= 100;
  const isEnRoute = status === 'unterwegs' || status === 'out_for_delivery' || status === 'picked_up';

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b">
        <div className={cn(
          'h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-colors',
          isDelivered ? 'bg-emerald-100 text-emerald-600' : 'bg-matcha-50 text-matcha-600',
        )}>
          <Clock className={cn('h-4.5 w-4.5', !isDelivered && !error && 'animate-pulse')} size={18} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Lieferstatus
          </div>
          <div className="text-sm font-bold text-foreground leading-tight mt-0.5">
            {phaseLabel}
          </div>
        </div>

        {/* ETA value */}
        <div className="text-right shrink-0">
          {isDelivered ? (
            <span className="text-sm font-black text-emerald-600">Geliefert!</span>
          ) : isEnRoute ? (
            <span className="text-sm font-black text-matcha-600 animate-pulse">Unterwegs</span>
          ) : etaMin != null && etaMin > 0 ? (
            <div>
              <span className="font-display font-black text-lg text-foreground tabular-nums">
                ~{etaMin}
              </span>
              <span className="text-xs text-muted-foreground ml-0.5">Min</span>
            </div>
          ) : error ? (
            <span className="text-[10px] text-muted-foreground">–</span>
          ) : null}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
          <span>Ankunft in {etaMin != null && etaMin > 0 ? `~${etaMin} Min` : isEnRoute ? 'Kürze' : '–'}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', progressColor(pct))}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Phase dots */}
        <div className="flex justify-between mt-2">
          {['Bestätigt', 'Zubereitung', 'Fertig', 'Unterwegs', 'Geliefert'].map((label, i) => {
            const thresholds = [20, 40, 70, 90, 100];
            const reached = pct >= thresholds[i];
            return (
              <div key={label} className="flex flex-col items-center gap-0.5">
                <div className={cn(
                  'h-1.5 w-1.5 rounded-full transition-colors',
                  reached ? progressColor(thresholds[i]) : 'bg-muted-foreground/30',
                )} />
                <span className={cn(
                  'text-[8px] leading-none',
                  reached ? 'text-foreground font-medium' : 'text-muted-foreground/50',
                )}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
