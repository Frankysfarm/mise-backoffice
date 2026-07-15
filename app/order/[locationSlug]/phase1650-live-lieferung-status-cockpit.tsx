'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Bike, CheckCircle2, Clock, MapPin, AlertCircle } from 'lucide-react';

/**
 * Phase 1650 — Live-Lieferung-Status-Cockpit (Storefront)
 *
 * Zeigt dem Kunden den aktuellen Status seiner Bestellung:
 * Küche → Fahrer unterwegs → Geliefert.
 * Dynamische ETA + Fahrer-Nähe-Indikator. 30s-Polling.
 */

type Phase = 'kueche' | 'unterwegs' | 'nah' | 'geliefert';

interface DeliveryStatus {
  phase: Phase;
  eta_min: number | null;
  driver_name: string | null;
  distance_m: number | null;
  kueche_status: string;
}

const MOCK: DeliveryStatus = {
  phase: 'unterwegs',
  eta_min: 12,
  driver_name: 'Max M.',
  distance_m: 800,
  kueche_status: 'Deine Bestellung ist fertig zubereitet.',
};

interface Props {
  orderId?: string | null;
  className?: string;
}

const PHASE_CONFIG: Record<Phase, {
  label: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  border: string;
  step: number;
}> = {
  kueche:    { label: 'Wird zubereitet',  sub: 'Die Küche arbeitet an deiner Bestellung.', icon: ChefHat,      color: 'text-amber-600',  bg: 'bg-amber-50 dark:bg-amber-900/20',  border: 'border-amber-200 dark:border-amber-700', step: 1 },
  unterwegs: { label: 'Fahrer unterwegs', sub: 'Deine Bestellung ist auf dem Weg.',        icon: Bike,         color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/20',    border: 'border-blue-200 dark:border-blue-700',   step: 2 },
  nah:       { label: 'Fast da!',         sub: 'Der Fahrer ist gleich bei dir.',            icon: MapPin,       color: 'text-matcha-600', bg: 'bg-matcha-50 dark:bg-matcha-900/20', border: 'border-matcha-200 dark:border-matcha-700', step: 3 },
  geliefert: { label: 'Geliefert!',       sub: 'Guten Appetit! 🎉',                         icon: CheckCircle2, color: 'text-matcha-600', bg: 'bg-matcha-50 dark:bg-matcha-900/20', border: 'border-matcha-200 dark:border-matcha-700', step: 4 },
};

const STEPS: Phase[] = ['kueche', 'unterwegs', 'nah', 'geliefert'];

export function StorefrontPhase1650LiveLieferungStatusCockpit({ orderId, className }: Props) {
  const [status, setStatus] = useState<DeliveryStatus | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!orderId) { setStatus(MOCK); return; }
    async function load() {
      try {
        const res = await fetch(`/api/delivery/order-status?order_id=${orderId}`);
        if (!res.ok) throw new Error();
        const raw = await res.json();
        const distM = raw.driver_distance_m ?? raw.distance_m ?? null;
        const etaMin = raw.eta_min ?? raw.remaining_min ?? null;
        let phase: Phase = 'kueche';
        if (raw.status === 'geliefert' || raw.delivered) phase = 'geliefert';
        else if (distM != null && distM < 300) phase = 'nah';
        else if (['unterwegs', 'on_route', 'picked_up'].includes(raw.status ?? '')) phase = 'unterwegs';
        else if (['fertig', 'ready'].includes(raw.status ?? '')) phase = 'unterwegs';
        setStatus({
          phase,
          eta_min: etaMin,
          driver_name: raw.driver_name ?? null,
          distance_m: distM,
          kueche_status: raw.kueche_status ?? '',
        });
        setError(false);
      } catch {
        setStatus(MOCK);
        setError(true);
      }
    }
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [orderId]);

  const s = status ?? MOCK;
  const cfg = PHASE_CONFIG[s.phase];
  const Icon = cfg.icon;
  const currentStep = cfg.step;

  return (
    <div className={cn('rounded-xl border shadow-sm overflow-hidden', cfg.bg, cfg.border, className)}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-black/20 shadow', cfg.border, 'border')}>
          <Icon className={cn('h-5 w-5', cfg.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn('text-sm font-bold', cfg.color)}>{cfg.label}</div>
          <div className="text-xs text-muted-foreground leading-tight mt-0.5">{cfg.sub}</div>
        </div>
        {s.eta_min != null && s.phase !== 'geliefert' && (
          <div className="shrink-0 text-right">
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-base font-black tabular-nums text-foreground">{s.eta_min}</span>
            </div>
            <div className="text-[9px] text-muted-foreground">Min verbleibend</div>
          </div>
        )}
      </div>

      {/* Step dots */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-1">
          {STEPS.map((step, i) => {
            const stepCfg = PHASE_CONFIG[step];
            const done = currentStep > stepCfg.step;
            const active = currentStep === stepCfg.step;
            return (
              <div key={step} className="flex items-center flex-1 last:flex-none">
                <div className={cn(
                  'h-2.5 w-2.5 rounded-full shrink-0 transition-all duration-500',
                  done ? 'bg-matcha-500' : active ? cn(cfg.color.replace('text-', 'bg-'), 'scale-125') : 'bg-muted',
                )} />
                {i < STEPS.length - 1 && (
                  <div className={cn('flex-1 h-0.5 mx-1 transition-all duration-700', done ? 'bg-matcha-500' : 'bg-muted')} />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-1">
          {STEPS.map(step => (
            <span key={step} className={cn('text-[9px]', PHASE_CONFIG[step].step === currentStep ? PHASE_CONFIG[step].color : 'text-muted-foreground')}>
              {PHASE_CONFIG[step].label.split(' ')[0]}
            </span>
          ))}
        </div>
      </div>

      {/* Driver info */}
      {s.driver_name && s.phase !== 'kueche' && s.phase !== 'geliefert' && (
        <div className="mx-3 mb-3 rounded-lg border bg-white/50 dark:bg-black/20 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bike className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-xs font-bold text-foreground">{s.driver_name}</span>
          </div>
          {s.distance_m != null && (
            <span className="text-xs text-muted-foreground">
              {s.distance_m >= 1000
                ? `${(s.distance_m / 1000).toFixed(1)} km`
                : `${Math.round(s.distance_m)} m`} entfernt
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="mx-3 mb-3 flex items-center gap-1.5 text-[10px] text-amber-600">
          <AlertCircle className="h-3 w-3" />
          Demo-Daten (Verbindungsfehler)
        </div>
      )}
    </div>
  );
}
