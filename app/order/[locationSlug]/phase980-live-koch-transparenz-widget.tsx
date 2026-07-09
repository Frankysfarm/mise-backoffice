'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Clock, Package, Flame, CheckCircle2, Bike } from 'lucide-react';

/**
 * Phase 980 — Live-Koch-Transparenz-Widget (Storefront)
 *
 * Animiertes Widget zeigt aktuellen Zubereitungs-Schritt der Bestellung:
 * Küche aktiv, Backstation, Warten auf Fahrer etc.
 */

type KochPhase =
  | 'eingegangen'
  | 'vorbereitung'
  | 'kochen'
  | 'fertigstellung'
  | 'warten_fahrer'
  | 'unterwegs';

interface KochStatus {
  phase: KochPhase;
  phase_label: string;
  phase_detail: string;
  seit_min: number;
  naechster_schritt?: string;
}

const PHASE_MAP: Record<string, KochPhase> = {
  neu:            'eingegangen',
  bestätigt:      'eingegangen',
  eingegangen:    'eingegangen',
  accepted:       'eingegangen',
  in_zubereitung: 'kochen',
  zubereitung:    'kochen',
  preparing:      'kochen',
  in_preparation: 'kochen',
  fertig:         'fertigstellung',
  abholbereit:    'fertigstellung',
  ready:          'fertigstellung',
  warten_fahrer:  'warten_fahrer',
  dispatched:     'warten_fahrer',
  abgeholt:       'unterwegs',
  unterwegs:      'unterwegs',
  in_lieferung:   'unterwegs',
  geliefert:      'unterwegs',
};

const PHASE_DETAILS: Record<KochPhase, { label: string; detail: string; icon: React.ReactNode; color: string }> = {
  eingegangen:    { label: 'Bestellung eingegangen',  detail: 'Küche bereitet sich vor',          icon: <Package className="h-5 w-5" />,       color: 'text-muted-foreground' },
  vorbereitung:   { label: 'Zutaten werden bereit gestellt', detail: 'Mise en place läuft',       icon: <ChefHat className="h-5 w-5" />,        color: 'text-blue-500' },
  kochen:         { label: 'Wird gerade zubereitet',  detail: 'Küche arbeitet an deiner Bestellung', icon: <Flame className="h-5 w-5" />,      color: 'text-orange-500' },
  fertigstellung: { label: 'Fast fertig!',             detail: 'Letzte Handgriffe, gleich bereit', icon: <CheckCircle2 className="h-5 w-5" />,   color: 'text-matcha-600' },
  warten_fahrer:  { label: 'Warten auf Fahrer',        detail: 'Bestellung bereit, Fahrer kommt', icon: <Clock className="h-5 w-5" />,          color: 'text-amber-500' },
  unterwegs:      { label: 'Unterwegs zu dir!',         detail: 'Fahrer ist auf dem Weg',           icon: <Bike className="h-5 w-5" />,           color: 'text-matcha-600' },
};

const STEPS: KochPhase[] = ['eingegangen', 'kochen', 'fertigstellung', 'warten_fahrer', 'unterwegs'];

interface Props {
  orderId?: string | null;
  status?: string | null;
  seitMin?: number;
  className?: string;
}

// Animated küchen flame dots
function KochAnimation({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="flex items-end gap-0.5 h-5">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="w-1.5 rounded-full bg-orange-400"
          style={{
            height: `${10 + (i % 2 === 0 ? 8 : 4)}px`,
            animation: `pulse ${0.8 + i * 0.2}s ease-in-out infinite alternate`,
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}

export function Phase980LiveKochTransparenzWidget({ orderId: _orderId, status = 'in_zubereitung', seitMin = 0, className }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const phase = PHASE_MAP[status ?? ''] ?? 'eingegangen';
  const info = PHASE_DETAILS[phase];
  const currentIdx = STEPS.indexOf(phase);
  const isKochen = phase === 'kochen';

  // Don't show after delivery
  if (status === 'geliefert' || status === 'zugestellt') return null;

  return (
    <div className={cn('rounded-2xl border bg-card overflow-hidden', className)} data-storefront-phase="980">
      {/* Küchen-Header */}
      <div className={cn(
        'px-4 py-3 flex items-center gap-3',
        isKochen
          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white'
          : phase === 'unterwegs'
            ? 'bg-gradient-to-r from-matcha-600 to-matcha-500 text-white'
            : 'bg-muted/30',
      )}>
        <div className={cn(
          'shrink-0 w-10 h-10 rounded-xl flex items-center justify-center',
          isKochen || phase === 'unterwegs' ? 'bg-white/20' : 'bg-muted',
        )}>
          <span className={cn(isKochen || phase === 'unterwegs' ? 'text-white' : info.color)}>
            {info.icon}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn(
            'font-bold text-sm leading-tight',
            isKochen || phase === 'unterwegs' ? 'text-white' : 'text-foreground',
          )}>
            {info.label}
          </div>
          <div className={cn(
            'text-[11px] mt-0.5',
            isKochen || phase === 'unterwegs' ? 'text-white/80' : 'text-muted-foreground',
          )}>
            {info.detail}
          </div>
        </div>
        {isKochen && <KochAnimation active />}
        {seitMin > 0 && (
          <div className={cn(
            'shrink-0 text-[10px] font-bold',
            isKochen || phase === 'unterwegs' ? 'text-white/70' : 'text-muted-foreground',
          )}>
            {seitMin} Min
          </div>
        )}
      </div>

      {/* Step-Progress */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-0">
          {STEPS.map((step, idx) => {
            const done   = idx < currentIdx;
            const active = idx === currentIdx;
            const future = idx > currentIdx;
            const last   = idx === STEPS.length - 1;
            const stepInfo = PHASE_DETAILS[step];

            return (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1 flex-none">
                  <div className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center transition-all duration-500',
                    done   ? 'bg-matcha-500 text-white' : '',
                    active ? cn('ring-4 ring-offset-1', isKochen ? 'bg-orange-500 text-white ring-orange-200' : 'bg-matcha-600 text-white ring-matcha-200') : '',
                    future ? 'bg-muted text-muted-foreground' : '',
                    active && !isKochen ? 'animate-pulse' : '',
                  )}>
                    <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">
                      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : stepInfo.icon}
                    </span>
                  </div>
                  <span className={cn(
                    'text-[8px] font-bold text-center leading-tight max-w-[44px]',
                    active ? (isKochen ? 'text-orange-600' : 'text-matcha-700 dark:text-matcha-300') : done ? 'text-matcha-600' : 'text-muted-foreground',
                  )}>
                    {PHASE_DETAILS[step].label.split(' ')[0]}
                  </span>
                </div>
                {!last && (
                  <div className={cn(
                    'flex-1 h-0.5 mx-0.5 rounded-full transition-all duration-700',
                    idx < currentIdx ? 'bg-matcha-400' : 'bg-muted',
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Fun kitchen fact während Kochen */}
      {isKochen && (
        <div className="px-4 pb-3">
          <div className="rounded-xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 px-3 py-2 flex items-center gap-2">
            <Flame className="h-3.5 w-3.5 text-orange-500 shrink-0 animate-pulse" />
            <span className="text-[11px] text-orange-700 dark:text-orange-300">
              Unser Koch arbeitet gerade mit voller Konzentration an deiner Bestellung!
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
