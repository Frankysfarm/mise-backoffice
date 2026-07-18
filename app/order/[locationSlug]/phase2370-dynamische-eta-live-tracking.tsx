'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, ChefHat, CheckCircle2, Clock, MapPin, Package, Zap, Navigation2 } from 'lucide-react';

type DeliveryPhase = 'bestaetigt' | 'zubereitung' | 'abholung' | 'unterwegs' | 'angekommen' | 'geliefert';

interface Props {
  orderId?: string | null;
  phase?: DeliveryPhase;
  etaMin?: number | null;
  fahrerName?: string | null;
  distanzM?: number | null;
  locationSlug?: string;
}

const PHASES: { key: DeliveryPhase; label: string; icon: React.ComponentType<{ className?: string; size?: number }> }[] = [
  { key: 'bestaetigt',  label: 'Bestätigt',   icon: Package },
  { key: 'zubereitung', label: 'Zubereitung', icon: ChefHat },
  { key: 'abholung',    label: 'Abholung',    icon: Bike },
  { key: 'unterwegs',   label: 'Unterwegs',   icon: Navigation2 },
  { key: 'angekommen',  label: 'Angekommen',  icon: MapPin },
  { key: 'geliefert',   label: 'Geliefert',   icon: CheckCircle2 },
];

function phaseIndex(p: DeliveryPhase) {
  return PHASES.findIndex(x => x.key === p);
}

function etaColorClass(min: number | null | undefined): string {
  if (min == null) return 'text-muted-foreground';
  if (min <= 5)  return 'text-matcha-600';
  if (min <= 15) return 'text-amber-600';
  return 'text-foreground';
}

export function StorefrontPhase2370DynamischeEtaLiveTracking({
  orderId,
  phase = 'zubereitung',
  etaMin = 25,
  fahrerName,
  distanzM,
}: Props) {
  const [currentEta, setCurrentEta] = useState<number>(etaMin ?? 25);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    setCurrentEta(etaMin ?? 25);
  }, [etaMin]);

  useEffect(() => {
    const id = setInterval(() => {
      setCurrentEta(e => Math.max(0, e - 1 / 60));
    }, 1_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!orderId) return;
    async function refresh() {
      try {
        const r = await fetch(`/api/delivery/customer/tracking?order_id=${orderId}`);
        if (!r.ok) return;
        const d = await r.json();
        if (d.eta_min != null) setCurrentEta(d.eta_min);
        setLastUpdate(new Date());
      } catch {}
    }
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [orderId]);

  const currentIndex = phaseIndex(phase);
  const etaRound = Math.ceil(currentEta);
  const isDone = phase === 'geliefert';
  const progressPct = isDone ? 100 : (currentIndex / (PHASES.length - 1)) * 100;

  return (
    <div className={cn(
      'rounded-2xl border shadow-sm overflow-hidden bg-card text-card-foreground',
      isDone && 'border-matcha-300',
    )}>
      {/* Header */}
      <div className={cn('flex items-center gap-3 px-4 pt-4 pb-3', isDone && 'bg-matcha-50 dark:bg-matcha-950/20')}>
        {(() => {
          const cfg = PHASES[currentIndex] ?? PHASES[0];
          const Icon = cfg.icon;
          return (
            <>
              <div className={cn(
                'shrink-0 h-11 w-11 rounded-full flex items-center justify-center',
                isDone ? 'bg-matcha-100' : 'bg-muted',
              )}>
                <Icon className={cn('h-5 w-5', isDone ? 'text-matcha-600' : 'text-foreground')} size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black leading-tight">{cfg.label}</p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Zap className="h-3 w-3 text-matcha-500" /> Live-Tracking aktiv
                </p>
              </div>
            </>
          );
        })()}
        {!isDone && (
          <div className={cn(
            'shrink-0 rounded-xl border px-3 py-2 text-center min-w-[56px]',
            etaRound <= 5  ? 'bg-matcha-100 border-matcha-300' :
            etaRound <= 15 ? 'bg-amber-100 border-amber-300' :
            'bg-muted/50 border-border',
          )}>
            <div className={cn('text-xl font-black tabular-nums leading-none', etaColorClass(etaRound))}>
              {etaRound}
            </div>
            <div className="text-[9px] text-muted-foreground font-semibold mt-0.5">Min</div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-1">
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-matcha-500 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="px-4 pb-3 pt-2">
        <div className="flex items-center justify-between">
          {PHASES.map((p, i) => {
            const done   = i < currentIndex;
            const active = i === currentIndex;
            const Icon   = p.icon;
            return (
              <div key={p.key} className="flex flex-col items-center gap-1 flex-1">
                <div className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center border-2 transition-all',
                  done   ? 'bg-matcha-500 border-matcha-500 text-white' :
                  active ? 'bg-blue-500 border-blue-500 text-white scale-110 shadow-md' :
                           'bg-background border-muted-foreground/30 text-muted-foreground/50',
                )}>
                  <Icon className="h-3.5 w-3.5" size={14} />
                </div>
                <span className={cn(
                  'text-[8px] font-semibold leading-none hidden sm:block truncate max-w-[44px] text-center',
                  active ? 'text-foreground font-black' : 'text-muted-foreground',
                )}>
                  {p.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fahrer info */}
      {(fahrerName || distanzM != null) && !isDone && (
        <div className="border-t px-4 py-2.5 flex items-center gap-3 bg-muted/20">
          <Bike className="h-4 w-4 text-matcha-600 shrink-0" />
          {fahrerName && <span className="text-xs font-bold">{fahrerName}</span>}
          {distanzM != null && (
            <span className="text-[11px] text-muted-foreground">
              {distanzM >= 1000 ? `${(distanzM / 1000).toFixed(1)} km` : `${distanzM} m`} entfernt
            </span>
          )}
          <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {lastUpdate.toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}

      {/* Done state */}
      {isDone && (
        <div className="border-t px-4 py-3 bg-matcha-50 dark:bg-matcha-950/20 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-xs font-black text-matcha-700 dark:text-matcha-300">
            Geliefert! Guten Appetit! 🎉
          </span>
        </div>
      )}
    </div>
  );
}
