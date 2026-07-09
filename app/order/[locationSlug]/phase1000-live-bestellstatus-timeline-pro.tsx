'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, Clock, Bike, ChefHat, ShoppingBag, Star } from 'lucide-react';

/**
 * Phase 1000 — Live-Bestellstatus-Timeline Pro (Storefront)
 *
 * Interaktive Timeline aller Phasen (Bestellt→Küche→Fertig→Unterwegs→Geliefert)
 * mit Echtzeit-Dots + Sekunden-Countdown + Puls-Animation.
 * Client-seitig. 30s-Polling.
 */

interface Props {
  orderId?: string | null;
  status?: string | null;
  etaMinutes?: number | null;
  driverName?: string | null;
  className?: string;
}

interface Phase {
  key: string;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
}

const PHASES: Phase[] = [
  { key: 'ordered', label: 'Bestellt', sublabel: 'Eingang bestätigt', icon: <ShoppingBag className="h-4 w-4" /> },
  { key: 'kitchen', label: 'Küche', sublabel: 'Wird zubereitet', icon: <ChefHat className="h-4 w-4" /> },
  { key: 'ready', label: 'Fertig', sublabel: 'Wartet auf Fahrer', icon: <CheckCircle2 className="h-4 w-4" /> },
  { key: 'driving', label: 'Unterwegs', sublabel: 'Fahrer auf dem Weg', icon: <Bike className="h-4 w-4" /> },
  { key: 'delivered', label: 'Geliefert', sublabel: 'Guten Appetit!', icon: <Star className="h-4 w-4" /> },
];

function statusToPhaseIndex(status: string | null | undefined): number {
  switch (status) {
    case 'pending': case 'new': case 'neu': case 'bestellt': return 0;
    case 'confirmed': case 'bestätigt': case 'accepted': return 1;
    case 'preparing': case 'in_preparation': case 'in_kitchen': return 1;
    case 'ready': case 'bereit': case 'ready_for_pickup': return 2;
    case 'assigned': case 'picked_up': case 'on_the_way': case 'unterwegs': return 3;
    case 'delivered': case 'geliefert': case 'completed': return 4;
    default: return 0;
  }
}

function useCountdown(etaMinutes: number | null | undefined): string | null {
  const [secsLeft, setSecsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!etaMinutes || etaMinutes <= 0) { setSecsLeft(null); return; }
    const target = Date.now() + etaMinutes * 60_000;
    const tick = () => {
      const left = Math.max(0, Math.round((target - Date.now()) / 1000));
      setSecsLeft(left);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [etaMinutes]);

  if (secsLeft === null) return null;
  const m = Math.floor(secsLeft / 60);
  const s = secsLeft % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function phaseColor(phaseIdx: number): { bg: string; text: string; border: string; dot: string; bar: string } {
  const colors = [
    { bg: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-400', dot: 'bg-blue-500', bar: 'bg-blue-500' },
    { bg: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-400', dot: 'bg-orange-500', bar: 'bg-orange-500' },
    { bg: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-400', dot: 'bg-amber-500', bar: 'bg-amber-500' },
    { bg: 'bg-matcha-500', text: 'text-matcha-600 dark:text-matcha-400', border: 'border-matcha-400', dot: 'bg-matcha-500', bar: 'bg-matcha-500' },
    { bg: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-400', dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
  ];
  return colors[Math.min(phaseIdx, colors.length - 1)];
}

export function Phase1000LiveBestellstatusTimelinePro({ orderId, status, etaMinutes, driverName, className }: Props) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [currentEta, setCurrentEta] = useState(etaMinutes);
  const countdown = useCountdown(currentEta);

  useEffect(() => {
    if (!orderId) return;
    async function poll() {
      try {
        const res = await fetch(`/api/delivery/tracking?order_id=${encodeURIComponent(orderId!)}`);
        if (!res.ok) return;
        const d = await res.json();
        if (d.status) setCurrentStatus(d.status);
        if (d.eta_minutes) setCurrentEta(d.eta_minutes);
      } catch { /* ignore */ }
    }
    poll();
    const iv = setInterval(poll, 30_000);
    return () => clearInterval(iv);
  }, [orderId]);

  const activeIdx = statusToPhaseIndex(currentStatus);
  const isDelivered = activeIdx === 4;
  const color = phaseColor(activeIdx);
  const progressPct = Math.round((activeIdx / (PHASES.length - 1)) * 100);

  return (
    <div className={cn('rounded-2xl overflow-hidden border shadow-sm bg-card', className)}>
      {/* Header */}
      <div className={cn('px-4 py-3 text-white', color.bg)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            <span className="text-sm font-bold">
              {isDelivered ? '🎉 Geliefert!' : 'Live-Tracking'}
            </span>
          </div>
          {countdown && !isDelivered && (
            <div className="flex items-center gap-1.5 bg-white/20 rounded-full px-2.5 py-1">
              <Clock className="h-3 w-3" />
              <span className="text-xs font-bold tabular-nums">{countdown}</span>
            </div>
          )}
          {isDelivered && (
            <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">Danke!</span>
          )}
        </div>
        {driverName && activeIdx === 3 && (
          <p className="text-xs text-white/80 mt-0.5">🚴 {driverName} ist unterwegs</p>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className={cn('h-full transition-all duration-700', color.bar)}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Timeline */}
      <div className="px-4 py-4">
        <div className="relative">
          {/* Connector line */}
          <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-muted" />

          <div className="space-y-4">
            {PHASES.map((phase, idx) => {
              const done = idx < activeIdx;
              const active = idx === activeIdx;
              const future = idx > activeIdx;
              const c = phaseColor(idx);

              return (
                <div key={phase.key} className="flex items-start gap-3 relative">
                  {/* Icon / dot */}
                  <div className={cn(
                    'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-500',
                    done ? `${c.bg} border-transparent text-white` : '',
                    active ? `border-2 ${c.border} bg-background ${c.text}` : '',
                    future ? 'border-border bg-muted/30 text-muted-foreground' : '',
                  )}>
                    {done ? <CheckCircle2 className="h-4 w-4" /> : phase.icon}
                    {active && (
                      <span className="absolute -inset-1 animate-ping rounded-full opacity-30" style={{ background: `currentColor` }} />
                    )}
                  </div>

                  {/* Labels */}
                  <div className={cn('flex-1 pt-1', future ? 'opacity-40' : '')}>
                    <div className={cn(
                      'text-sm font-semibold leading-tight',
                      active ? color.text : done ? 'text-foreground' : 'text-muted-foreground',
                    )}>
                      {phase.label}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{phase.sublabel}</div>
                  </div>

                  {/* Active badge */}
                  {active && (
                    <div className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 mt-1', `${c.bg} text-white`)}>
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/70" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                      </span>
                      Aktiv
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {isDelivered && (
          <div className="mt-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 p-3 text-center">
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Guten Appetit! 🍽️</p>
            <p className="text-xs text-muted-foreground mt-0.5">Wie war Ihre Bestellung?</p>
          </div>
        )}
      </div>
    </div>
  );
}
