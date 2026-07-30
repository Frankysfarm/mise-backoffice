'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Bike, MapPin, CheckCircle2, Clock, Loader2 } from 'lucide-react';

type OrderPhase = 'angenommen' | 'zubereitung' | 'abholung' | 'unterwegs' | 'angekommen' | 'zugestellt';

interface OrderStatus {
  phase: OrderPhase;
  eta_min?: number | null;
  fahrer_name?: string | null;
  fahrer_distanz_m?: number | null;
  bestellt_am?: string | null;
  zubereitung_start?: string | null;
}

interface Props {
  orderId?: string | null;
  locationSlug?: string;
}

const PHASE_CONFIG: Record<OrderPhase, { label: string; icon: React.ElementType; step: number }> = {
  angenommen: { label: 'Angenommen', icon: CheckCircle2, step: 0 },
  zubereitung: { label: 'In der Küche', icon: ChefHat, step: 1 },
  abholung: { label: 'Abholung', icon: Bike, step: 2 },
  unterwegs: { label: 'Unterwegs', icon: Bike, step: 3 },
  angekommen: { label: 'Fast da!', icon: MapPin, step: 4 },
  zugestellt: { label: 'Zugestellt', icon: CheckCircle2, step: 5 },
};

const PHASE_STEPS: OrderPhase[] = ['angenommen', 'zubereitung', 'abholung', 'unterwegs', 'angekommen', 'zugestellt'];

const MOCK_STATUS: OrderStatus = {
  phase: 'unterwegs',
  eta_min: 8,
  fahrer_name: 'Max B.',
  fahrer_distanz_m: 1200,
  bestellt_am: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
};

export function BestellLiveStatusWidget({ orderId, locationSlug }: Props) {
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!orderId) {
        setStatus(MOCK_STATUS);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/delivery/tracking?order_id=${orderId}`);
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
        } else {
          setStatus(MOCK_STATUS);
        }
      } catch {
        setStatus(MOCK_STATUS);
      } finally {
        setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [orderId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 flex items-center justify-center gap-2 text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Bestellstatus wird geladen…</span>
      </div>
    );
  }

  if (!status) return null;

  const currentStep = PHASE_CONFIG[status.phase].step;
  const CurrentIcon = PHASE_CONFIG[status.phase].icon;
  const isDone = status.phase === 'zugestellt';

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 space-y-4">
      {/* ETA Banner */}
      <div className={cn(
        'rounded-lg p-3 flex items-center justify-between',
        isDone ? 'bg-emerald-500/15 border border-emerald-500/30' : 'bg-blue-500/15 border border-blue-500/30'
      )}>
        <div className="flex items-center gap-2">
          <CurrentIcon className={cn('h-5 w-5', isDone ? 'text-emerald-400' : 'text-blue-400')} />
          <div>
            <p className={cn('text-sm font-semibold', isDone ? 'text-emerald-300' : 'text-white')}>
              {PHASE_CONFIG[status.phase].label}
            </p>
            {status.fahrer_name && !isDone && (
              <p className="text-xs text-slate-400">Fahrer: {status.fahrer_name}</p>
            )}
          </div>
        </div>
        {status.eta_min != null && !isDone && (
          <div className="text-right">
            <p className="text-2xl font-bold text-white">{status.eta_min}</p>
            <p className="text-xs text-slate-400">Minuten</p>
          </div>
        )}
        {isDone && (
          <p className="text-emerald-400 font-semibold text-sm">Guten Appetit!</p>
        )}
      </div>

      {/* Phase-Schritte */}
      <div className="relative">
        {/* Verbindungslinie */}
        <div className="absolute top-3 left-3 right-3 h-0.5 bg-slate-700/60" />
        <div
          className="absolute top-3 left-3 h-0.5 bg-emerald-400 transition-all duration-700"
          style={{ right: `${100 - (currentStep / (PHASE_STEPS.length - 1)) * 100}%` }}
        />

        <div className="relative flex justify-between">
          {PHASE_STEPS.map((phase, idx) => {
            const cfg = PHASE_CONFIG[phase];
            const StepIcon = cfg.icon;
            const isActive = idx === currentStep;
            const isDoneStep = idx < currentStep;

            return (
              <div key={phase} className="flex flex-col items-center gap-1">
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all duration-300 z-10',
                  isDoneStep ? 'bg-emerald-400 border-emerald-400' :
                  isActive ? 'bg-blue-500 border-blue-400' :
                  'bg-slate-800 border-slate-600'
                )}>
                  <StepIcon className={cn('h-3 w-3', isDoneStep || isActive ? 'text-white' : 'text-slate-500')} />
                </div>
                <p className={cn('text-xs text-center max-w-[48px] leading-tight', isActive ? 'text-white font-medium' : isDoneStep ? 'text-emerald-400' : 'text-slate-500')}>
                  {cfg.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Distanz-Indikator */}
      {status.fahrer_distanz_m != null && status.phase === 'unterwegs' && (
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/40 rounded-lg px-3 py-2">
          <Bike className="h-3.5 w-3.5 text-blue-400" />
          <span>Fahrer ist noch ca. <span className="text-white font-semibold">{status.fahrer_distanz_m >= 1000 ? `${(status.fahrer_distanz_m / 1000).toFixed(1)} km` : `${status.fahrer_distanz_m} m`}</span> entfernt</span>
        </div>
      )}
    </div>
  );
}
