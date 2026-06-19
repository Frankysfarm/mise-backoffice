'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, ChefHat, Package, Bike, Star } from 'lucide-react';

interface Props {
  orderId: string;
  bestellnummer?: string | null;
  initialStatus?: string | null;
  initialEtaMin?: number | null;
}

const STEPS = [
  { key: 'neu',            label: 'Angenommen',    icon: CheckCircle2, color: 'matcha' },
  { key: 'in_zubereitung', label: 'Zubereitung',   icon: ChefHat,       color: 'amber'  },
  { key: 'fertig',         label: 'Bereit',         icon: Package,       color: 'blue'   },
  { key: 'unterwegs',      label: 'Unterwegs',      icon: Bike,          color: 'orange' },
  { key: 'geliefert',      label: 'Geliefert',      icon: Star,          color: 'emerald'},
] as const;

const STATUS_TO_STEP: Record<string, number> = {
  neu: 0, bestätigt: 0, angenommen: 0,
  in_zubereitung: 1, preparing: 1,
  fertig: 2, ready: 2,
  unterwegs: 3, out_for_delivery: 3, picked_up: 3,
  geliefert: 4, delivered: 4, completed: 4, abgeholt: 4, abgeschlossen: 4,
};

const STEP_COLOR = {
  matcha: { active: 'bg-matcha-500 text-white border-matcha-500', done: 'bg-matcha-100 text-matcha-700 border-matcha-300', line: 'bg-matcha-400' },
  amber:  { active: 'bg-amber-500 text-white border-amber-500',   done: 'bg-amber-100 text-amber-700 border-amber-300',   line: 'bg-amber-400'   },
  blue:   { active: 'bg-sky-500 text-white border-sky-500',       done: 'bg-sky-100 text-sky-700 border-sky-300',         line: 'bg-sky-400'     },
  orange: { active: 'bg-orange-500 text-white border-orange-500', done: 'bg-orange-100 text-orange-700 border-orange-300',line: 'bg-orange-400'  },
  emerald:{ active: 'bg-emerald-500 text-white border-emerald-500',done:'bg-emerald-100 text-emerald-700 border-emerald-300',line:'bg-emerald-400'},
};

export function BestellungFortschrittKarte({ orderId, bestellnummer, initialStatus, initialEtaMin }: Props) {
  const [status, setStatus] = useState(initialStatus ?? 'neu');
  const [etaMin, setEtaMin] = useState<number | null>(initialEtaMin ?? null);

  useEffect(() => {
    if (!orderId) return;
    let mounted = true;
    async function poll() {
      try {
        const res = await fetch(`/api/delivery/eta/${orderId}`);
        if (!res.ok || !mounted) return;
        const data = await res.json();
        if (data?.status) setStatus(data.status);
        if (data?.eta_min != null) setEtaMin(data.eta_min);
      } catch { /* silent */ }
    }
    poll();
    const iv = setInterval(poll, 30_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [orderId]);

  // Local ETA countdown
  useEffect(() => {
    if (etaMin == null || etaMin <= 0) return;
    const iv = setInterval(() => setEtaMin((p) => (p != null && p > 0 ? p - 1 : p)), 60_000);
    return () => clearInterval(iv);
  }, [etaMin]);

  const currentStep = STATUS_TO_STEP[status] ?? 0;
  const isDelivered = currentStep >= 4;

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Header */}
      <div className={cn(
        'flex items-center justify-between px-4 py-3 border-b',
        isDelivered ? 'bg-emerald-50' : 'bg-matcha-50/60',
      )}>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Bestellstatus
          </div>
          {bestellnummer && (
            <div className="text-xs font-black text-foreground">#{bestellnummer}</div>
          )}
        </div>
        {!isDelivered && etaMin != null && etaMin > 0 ? (
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground">Ankunft in</div>
            <div className="text-lg font-black tabular-nums text-matcha-700 leading-tight">
              ~{etaMin} <span className="text-xs font-semibold">Min</span>
            </div>
          </div>
        ) : isDelivered ? (
          <span className="text-sm font-black text-emerald-600">Geliefert! ✓</span>
        ) : (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3 animate-pulse" />
            Wird berechnet…
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="px-4 py-4">
        <div className="flex items-start gap-0">
          {STEPS.map((step, idx) => {
            const done = idx < currentStep;
            const active = idx === currentStep;
            const colors = STEP_COLOR[step.color];
            const Icon = step.icon;

            return (
              <div key={step.key} className="flex flex-col items-center flex-1 min-w-0">
                {/* Icon circle */}
                <div className={cn(
                  'h-9 w-9 rounded-full border-2 flex items-center justify-center transition-all duration-500 z-10',
                  done ? colors.done :
                  active ? cn(colors.active, 'ring-2 ring-offset-2 ring-current/30') :
                  'bg-muted border-border text-muted-foreground',
                )}>
                  <Icon className={cn(
                    'h-4 w-4 shrink-0',
                    active && 'animate-pulse',
                  )} />
                </div>

                {/* Label */}
                <div className={cn(
                  'mt-1.5 text-center text-[9px] font-bold leading-tight',
                  done || active ? 'text-foreground' : 'text-muted-foreground',
                )}>
                  {step.label}
                </div>

                {/* Connector line */}
                {idx < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'absolute h-0.5 w-full mt-[18px] transition-all duration-700',
                      done ? colors.line : 'bg-border',
                    )}
                    style={{ zIndex: 0 }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
