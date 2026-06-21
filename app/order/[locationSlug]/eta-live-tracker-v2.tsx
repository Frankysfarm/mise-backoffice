'use client';

import { useEffect, useRef, useState } from 'react';
import { Bike, CheckCircle2, ChevronRight, Clock, MapPin, Package, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  orderId: string;
  initialStatus?: string | null;
  initialEtaMin?: number | null;
  bestellnummer?: string;
}

type Phase = {
  key: string;
  label: string;
  icon: React.ElementType;
  statuses: string[];
};

const PHASES: Phase[] = [
  { key: 'bestätigt', label: 'Angenommen', icon: CheckCircle2, statuses: ['bestätigt', 'angenommen', 'neu'] },
  { key: 'in_zubereitung', label: 'Zubereitung', icon: Package, statuses: ['in_zubereitung', 'preparing'] },
  { key: 'fertig', label: 'Bereit', icon: Sparkles, statuses: ['fertig', 'ready'] },
  { key: 'unterwegs', label: 'Unterwegs', icon: Bike, statuses: ['unterwegs', 'out_for_delivery', 'picked_up'] },
  { key: 'geliefert', label: 'Geliefert', icon: MapPin, statuses: ['geliefert', 'delivered', 'completed'] },
];

function getPhaseIndex(status: string | null): number {
  if (!status) return 0;
  const idx = PHASES.findIndex(p => p.statuses.includes(status));
  return idx < 0 ? 0 : idx;
}

function phaseProgress(phaseIdx: number): number {
  return Math.round(((phaseIdx + 1) / PHASES.length) * 100);
}

function formatMin(min: number): string {
  if (min <= 0) return 'Gleich da';
  if (min === 1) return '1 Minute';
  return `${min} Minuten`;
}

export function EtaLiveTrackerV2({ orderId, initialStatus, initialEtaMin, bestellnummer }: Props) {
  const [status, setStatus] = useState<string | null>(initialStatus ?? null);
  const [etaMin, setEtaMin] = useState<number | null>(initialEtaMin ?? null);
  const [driverLat, setDriverLat] = useState<number | null>(null);
  const [driverLng, setDriverLng] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Poll order status + ETA
  useEffect(() => {
    if (!orderId) return;

    async function poll() {
      try {
        const res = await fetch(`/api/delivery/customer/tracking?orderId=${orderId}`);
        if (!mounted.current) return;
        if (!res.ok) {
          // Fallback: try ETA endpoint
          const r2 = await fetch(`/api/delivery/eta/${orderId}`);
          if (r2.ok) {
            const d = await r2.json();
            if (mounted.current) {
              if (d?.eta_min != null) setEtaMin(d.eta_min);
              if (d?.status) setStatus(d.status);
            }
          }
          return;
        }
        setError(false);
        const data = await res.json();
        if (data?.status) setStatus(data.status);
        if (data?.eta_min != null) setEtaMin(data.eta_min);
        if (data?.driver_lat != null) setDriverLat(data.driver_lat);
        if (data?.driver_lng != null) setDriverLng(data.driver_lng);
      } catch {
        if (mounted.current) setError(true);
      }
    }

    poll();
    const iv = setInterval(poll, 20_000);
    return () => clearInterval(iv);
  }, [orderId]);

  // 1-min local countdown
  useEffect(() => {
    if (etaMin == null || etaMin <= 0) return;
    const iv = setInterval(() => {
      setEtaMin(p => (p != null && p > 0 ? p - 1 : p));
    }, 60_000);
    return () => clearInterval(iv);
  }, [etaMin]);

  const phaseIdx = getPhaseIndex(status);
  const pct = phaseProgress(phaseIdx);
  const currentPhase = PHASES[phaseIdx];
  const isDelivered = phaseIdx >= PHASES.length - 1;
  const isEnRoute = status === 'unterwegs' || status === 'out_for_delivery' || status === 'picked_up';

  return (
    <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
      {/* Top strip */}
      <div className={cn(
        'px-4 py-3 flex items-center gap-3',
        isDelivered ? 'bg-emerald-50 border-b border-emerald-100' : 'bg-matcha-50 border-b border-matcha-100',
      )}>
        <div className={cn(
          'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
          isDelivered ? 'bg-emerald-100' : 'bg-white shadow-sm',
        )}>
          {isDelivered
            ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            : <currentPhase.icon className={cn('h-5 w-5', isEnRoute ? 'text-matcha-600 animate-bounce' : 'text-matcha-600')} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className={cn(
            'text-[10px] font-bold uppercase tracking-widest',
            isDelivered ? 'text-emerald-600' : 'text-matcha-600',
          )}>
            {isDelivered ? 'Zugestellt!' : 'Live-Tracking'}
          </div>
          <div className="text-sm font-black text-foreground mt-0.5">
            {isDelivered
              ? 'Deine Bestellung ist angekommen 🎉'
              : currentPhase.label}
          </div>
          {bestellnummer && (
            <div className="text-[10px] text-muted-foreground mt-0.5">#{bestellnummer}</div>
          )}
        </div>

        {/* ETA callout */}
        {!isDelivered && (
          <div className="text-right shrink-0">
            {isEnRoute && etaMin != null && etaMin <= 5 ? (
              <div className="flex flex-col items-end">
                <span className="text-base font-black text-matcha-700 animate-pulse tabular-nums">
                  {formatMin(etaMin)}
                </span>
                <span className="text-[9px] text-muted-foreground">Ankunft</span>
              </div>
            ) : etaMin != null && etaMin > 0 ? (
              <div className="flex flex-col items-end">
                <span className="text-xl font-black text-foreground tabular-nums">~{etaMin}</span>
                <span className="text-[9px] text-muted-foreground">Min</span>
              </div>
            ) : isEnRoute ? (
              <span className="text-sm font-bold text-matcha-600">Bald da</span>
            ) : null}
          </div>
        )}
      </div>

      {/* Progress section */}
      <div className="px-4 py-3 space-y-3">
        {/* Progress bar */}
        <div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                isDelivered ? 'bg-emerald-500' : pct >= 80 ? 'bg-matcha-500' : pct >= 50 ? 'bg-amber-400' : 'bg-matcha-400',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Phase steps */}
        <div className="flex items-start justify-between">
          {PHASES.map((phase, i) => {
            const done = i < phaseIdx;
            const active = i === phaseIdx;
            const Icon = phase.icon;
            return (
              <div key={phase.key} className="flex flex-col items-center gap-1 flex-1">
                {i < PHASES.length - 1 && (
                  <div className="w-full flex items-center">
                    <div className={cn(
                      'h-6 w-6 rounded-full flex items-center justify-center mx-auto',
                      done ? 'bg-matcha-500' : active ? 'bg-matcha-100 ring-2 ring-matcha-400' : 'bg-muted',
                    )}>
                      <Icon className={cn(
                        'h-3 w-3',
                        done ? 'text-white' : active ? 'text-matcha-600' : 'text-muted-foreground',
                      )} />
                    </div>
                    {i < PHASES.length - 1 && (
                      <div className={cn('h-0.5 flex-1', done ? 'bg-matcha-400' : 'bg-muted')} />
                    )}
                  </div>
                )}
                {i === PHASES.length - 1 && (
                  <div className={cn(
                    'h-6 w-6 rounded-full flex items-center justify-center mx-auto',
                    done || active ? 'bg-emerald-500' : 'bg-muted',
                  )}>
                    <Icon className={cn('h-3 w-3', done || active ? 'text-white' : 'text-muted-foreground')} />
                  </div>
                )}
                <span className={cn(
                  'text-[8px] text-center leading-tight max-w-[40px]',
                  done ? 'text-matcha-600 font-medium' : active ? 'text-matcha-700 font-bold' : 'text-muted-foreground',
                )}>
                  {phase.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Driver en-route hint */}
        {isEnRoute && (
          <div className="rounded-xl bg-matcha-50 border border-matcha-100 px-3 py-2.5 flex items-center gap-2">
            <Bike className="h-4 w-4 text-matcha-600 shrink-0 animate-bounce" />
            <div className="flex-1 text-xs text-matcha-700">
              Dein Fahrer ist <span className="font-bold">unterwegs</span>
              {etaMin != null && etaMin > 0 && ` · Ankunft in ~${etaMin} Min`}
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-matcha-400 shrink-0" />
          </div>
        )}

        {/* ETA precision hint */}
        {!isDelivered && !error && etaMin != null && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            <span>
              Lieferung erwartet um{' '}
              <span className="font-bold text-foreground">
                {new Date(Date.now() + etaMin * 60_000).toLocaleTimeString('de-DE', {
                  hour: '2-digit',
                  minute: '2-digit',
                })} Uhr
              </span>
            </span>
          </div>
        )}

        {isDelivered && (
          <div className="text-center py-1">
            <span className="text-sm font-bold text-emerald-600">
              Guten Appetit! 🍽️
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
