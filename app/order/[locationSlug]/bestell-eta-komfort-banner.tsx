'use client';

/**
 * BestellEtaKomfortBanner — Phase 421
 *
 * Beruhigungs-Banner für Kunden während der Lieferung:
 * - Zeigt einen statusabhängigen Komfort-Text
 * - Animierte ETA-Phasenprogression
 * - Nur sichtbar wenn Bestellung aktiv unterwegs
 */

import { useEffect, useState } from 'react';
import { ChefHat, Clock, Heart, Package, Sparkles, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  status: string;
  restaurantName?: string | null;
  etaLatest?: string | null;
  fahrerVorname?: string | null;
  className?: string;
}

type Phase = 'zubereitung' | 'fertig' | 'unterwegs' | 'nahend';

function detectPhase(status: string, etaLatest: string | null): Phase | null {
  if (status === 'in_zubereitung' || status === 'bestätigt') return 'zubereitung';
  if (status === 'fertig') return 'fertig';
  if (status === 'unterwegs') {
    if (!etaLatest) return 'unterwegs';
    const diffMin = (new Date(etaLatest).getTime() - Date.now()) / 60_000;
    if (diffMin <= 5) return 'nahend';
    return 'unterwegs';
  }
  return null;
}

const PHASE_CONFIG: Record<Phase, {
  icon: typeof ChefHat;
  color: string;
  bg: string;
  border: string;
  texts: string[];
}> = {
  zubereitung: {
    icon: ChefHat,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    texts: [
      'Dein Essen wird frisch zubereitet.',
      'Unsere Küche arbeitet mit vollem Einsatz für dich.',
      'Gute Dinge brauchen etwas Zeit — dein Essen ist fast fertig.',
    ],
  },
  fertig: {
    icon: Package,
    color: 'text-matcha-700',
    bg: 'bg-matcha-50',
    border: 'border-matcha-200',
    texts: [
      'Dein Essen ist fertig und wird gerade abgeholt.',
      'Alles verpackt und bereit — der Fahrer ist gleich da.',
      'Fertig! Dein Fahrer ist auf dem Weg zum Restaurant.',
    ],
  },
  unterwegs: {
    icon: Truck,
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    texts: [
      'Dein Essen ist unterwegs zu dir.',
      'Dein Fahrer bringt alles frisch zu dir.',
      'Noch ein paar Minuten — dein Essen ist auf dem Weg.',
    ],
  },
  nahend: {
    icon: Sparkles,
    color: 'text-matcha-700',
    bg: 'bg-matcha-50',
    border: 'border-matcha-200',
    texts: [
      'Dein Fahrer ist fast da — bereit machen!',
      'Noch wenige Minuten — dein Essen kommt gleich an.',
      'Fast angekommen! Gleich kannst du loslegen.',
    ],
  },
};

function EtaPhasenStreifen({ status, etaLatest }: { status: string; etaLatest: string | null }) {
  const phases: { key: Phase | 'geliefert'; label: string; icon: typeof ChefHat; done: boolean; active: boolean }[] = [
    {
      key: 'zubereitung',
      label: 'Zubereitung',
      icon: ChefHat,
      done: ['fertig', 'unterwegs', 'nahend', 'geliefert'].some(s => status === s || status === 'unterwegs'),
      active: status === 'in_zubereitung' || status === 'bestätigt',
    },
    {
      key: 'fertig',
      label: 'Abholung',
      icon: Package,
      done: status === 'unterwegs' || status === 'geliefert',
      active: status === 'fertig',
    },
    {
      key: 'unterwegs',
      label: 'Unterwegs',
      icon: Truck,
      done: status === 'geliefert',
      active: status === 'unterwegs',
    },
    {
      key: 'geliefert',
      label: 'Geliefert',
      icon: Heart,
      done: false,
      active: status === 'geliefert',
    },
  ];

  return (
    <div className="flex items-center gap-1">
      {phases.map((p, i) => {
        const Icon = p.icon;
        return (
          <div key={p.key} className="flex items-center gap-1 flex-1">
            <div className={cn(
              'flex flex-col items-center gap-0.5 flex-1',
            )}>
              <div className={cn(
                'h-5 w-5 rounded-full flex items-center justify-center',
                p.done ? 'bg-matcha-500' : p.active ? 'bg-matcha-400 animate-pulse' : 'bg-muted',
              )}>
                <Icon className={cn('h-2.5 w-2.5', p.done || p.active ? 'text-white' : 'text-muted-foreground')} />
              </div>
              <span className={cn('text-[8px] font-medium text-center leading-tight',
                p.done || p.active ? 'text-matcha-700' : 'text-muted-foreground'
              )}>
                {p.label}
              </span>
            </div>
            {i < phases.length - 1 && (
              <div className={cn('h-0.5 flex-shrink-0 w-3 mb-3', p.done ? 'bg-matcha-400' : 'bg-muted')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function BestellEtaKomfortBanner({ status, restaurantName, etaLatest, fahrerVorname, className }: Props) {
  const [textIdx, setTextIdx] = useState(0);
  const phase = detectPhase(status, etaLatest ?? null);

  useEffect(() => {
    if (!phase) return;
    const iv = setInterval(() => {
      setTextIdx(i => (i + 1) % PHASE_CONFIG[phase].texts.length);
    }, 8_000);
    return () => clearInterval(iv);
  }, [phase]);

  if (!phase || status === 'geliefert' || status === 'storniert') return null;

  const cfg  = PHASE_CONFIG[phase];
  const Icon = cfg.icon;
  const text = cfg.texts[textIdx % cfg.texts.length];

  let etaText = '';
  if (etaLatest) {
    const diffMin = Math.max(0, Math.round((new Date(etaLatest).getTime() - Date.now()) / 60_000));
    if (phase === 'nahend') {
      etaText = `≈ ${diffMin} Min`;
    } else if (diffMin > 0) {
      etaText = `ETA ~${diffMin} Min`;
    }
  }

  return (
    <div className={cn('rounded-2xl border px-4 py-3 space-y-2.5', cfg.bg, cfg.border, className)}>
      {/* Icon + Text */}
      <div className="flex items-start gap-3">
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', cfg.border, 'border bg-white/60')}>
          <Icon className={cn('h-4 w-4', cfg.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn('text-sm font-semibold leading-snug', cfg.color)}>
            {text}
          </div>
          {(restaurantName || fahrerVorname) && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              {phase === 'unterwegs' || phase === 'nahend'
                ? fahrerVorname ? `Fahrer: ${fahrerVorname}` : restaurantName ?? ''
                : restaurantName ?? ''}
            </div>
          )}
        </div>
        {etaText && (
          <div className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold', cfg.border, 'border', cfg.color, 'bg-white/60')}>
            {etaText}
          </div>
        )}
      </div>

      {/* Fortschritts-Phasen */}
      <EtaPhasenStreifen status={status} etaLatest={etaLatest ?? null} />
    </div>
  );
}
