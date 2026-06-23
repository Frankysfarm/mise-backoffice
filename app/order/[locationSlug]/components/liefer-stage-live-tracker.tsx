'use client';

import * as React from 'react';
import { ShoppingBag, ChefHat, Truck, CheckCircle2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  bestellnummer: string;
  initialEtaMin?: number | null;
  initialStatus?: string | null;
}

type Stage = 'bestellt' | 'zubereitung' | 'unterwegs' | 'geliefert';

const STAGES: { id: Stage; label: string; icon: React.ElementType }[] = [
  { id: 'bestellt', label: 'Bestellt', icon: ShoppingBag },
  { id: 'zubereitung', label: 'In Zubereitung', icon: ChefHat },
  { id: 'unterwegs', label: 'Unterwegs', icon: Truck },
  { id: 'geliefert', label: 'Geliefert!', icon: CheckCircle2 },
];

function mapStatusToStage(status: string): Stage {
  switch (status) {
    case 'pending':
    case 'confirmed':
    case 'bestätigt':
      return 'bestellt';
    case 'preparing':
    case 'in_kitchen':
    case 'in_zubereitung':
      return 'zubereitung';
    case 'ready':
    case 'picked_up':
    case 'on_the_way':
    case 'fertig':
    case 'unterwegs':
      return 'unterwegs';
    case 'delivered':
    case 'completed':
    case 'geliefert':
      return 'geliefert';
    default:
      return 'zubereitung';
  }
}

function stageIndex(stage: Stage): number {
  return STAGES.findIndex((s) => s.id === stage);
}

export function LieferStageLiveTracker({ bestellnummer, initialEtaMin, initialStatus }: Props) {
  const [stage, setStage] = React.useState<Stage>(() =>
    initialStatus ? mapStatusToStage(initialStatus) : 'zubereitung'
  );
  const [etaMin, setEtaMin] = React.useState<number>(initialEtaMin ?? 28);

  React.useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/order/status?nr=${encodeURIComponent(bestellnummer)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.status) {
          setStage(mapStatusToStage(data.status));
        }
        if (typeof data?.eta_min === 'number') {
          setEtaMin(data.eta_min);
        }
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 30_000);
    return () => clearInterval(iv);
  }, [bestellnummer]);

  React.useEffect(() => {
    if (etaMin <= 0) return;
    const t = setInterval(() => {
      setEtaMin((m) => Math.max(0, m - 0.5));
    }, 30_000);
    return () => clearInterval(t);
  }, [etaMin]);

  const activeIdx = stageIndex(stage);

  return (
    <div className="mt-4 w-full rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-matcha-300">
          Lieferstatus
        </span>
        {stage !== 'geliefert' && etaMin > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-matcha-700/60 px-2.5 py-1 text-[10px] font-bold text-accent ring-1 ring-accent/20">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
            </span>
            ca. {Math.ceil(etaMin)} Min
          </span>
        )}
      </div>

      <div className="relative flex items-start justify-between">
        <div
          className="absolute top-5 left-0 right-0 h-0.5 bg-stone-700 mx-[10%]"
          aria-hidden
        />
        <div
          className="absolute top-5 left-0 h-0.5 bg-matcha-500 mx-[10%] transition-all duration-700"
          style={{
            width: activeIdx === 0
              ? '0%'
              : `calc(${(activeIdx / (STAGES.length - 1)) * 100}% - 0px)`,
            maxWidth: '80%',
          }}
          aria-hidden
        />

        {STAGES.map((s, idx) => {
          const isCompleted = idx < activeIdx;
          const isActive = idx === activeIdx;
          const isPending = idx > activeIdx;
          const Icon = s.icon;

          return (
            <div key={s.id} className="relative z-10 flex flex-col items-center gap-2" style={{ width: '25%' }}>
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-500',
                  isActive && 'border-matcha-600 bg-matcha-600/20 animate-pulse',
                  isCompleted && 'border-matcha-500 bg-matcha-500/20',
                  isPending && 'border-stone-600 bg-stone-800/40',
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4 text-matcha-500" strokeWidth={2.5} />
                ) : (
                  <Icon
                    className={cn(
                      'h-4 w-4',
                      isActive && 'text-matcha-600',
                      isPending && 'text-stone-300',
                    )}
                    strokeWidth={isActive ? 2.5 : 1.5}
                  />
                )}
              </div>
              <span
                className={cn(
                  'text-center text-[9px] font-bold leading-tight',
                  isActive && 'text-matcha-600',
                  isCompleted && 'text-matcha-500',
                  isPending && 'text-stone-300',
                )}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
