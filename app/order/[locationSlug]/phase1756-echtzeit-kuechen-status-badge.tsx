'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, X } from 'lucide-react';

/**
 * Phase 1756 — Echtzeit-Küchen-Status-Badge (Storefront)
 *
 * "Küche beschäftigt / normal / frei" basierend auf aktiver Bestelllast.
 * 5-Min-Polling. Hydration-safe. Schließbar.
 * GET /api/delivery/public/kuechen-status?location_id=<id>
 */

type KuechenStatus = 'frei' | 'normal' | 'beschaeftigt' | 'sehr_beschaeftigt';

interface KuechenStatusData {
  status: KuechenStatus;
  aktive_bestellungen: number;
  eta_aufschlag_min: number;
}

interface Props {
  locationId?: string | null;
  className?: string;
}

const MOCK: KuechenStatusData = { status: 'normal', aktive_bestellungen: 4, eta_aufschlag_min: 0 };

const STATUS_CONFIG: Record<KuechenStatus, { label: string; emoji: string; bg: string; text: string; border: string }> = {
  frei: {
    label: 'Küche frei', emoji: '✓',
    bg: 'bg-green-50 dark:bg-green-950/30',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-800',
  },
  normal: {
    label: 'Küche normal ausgelastet', emoji: '👨‍🍳',
    bg: 'bg-white dark:bg-card',
    text: 'text-stone-700 dark:text-stone-300',
    border: 'border-stone-200 dark:border-stone-700',
  },
  beschaeftigt: {
    label: 'Küche beschäftigt', emoji: '⏳',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
  },
  sehr_beschaeftigt: {
    label: 'Küche sehr beschäftigt', emoji: '🔥',
    bg: 'bg-red-50 dark:bg-red-950/30',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
  },
};

export function StorefrontPhase1756EchtzeitKuechenStatusBadge({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<KuechenStatusData>(MOCK);
  const [closed, setClosed] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/public/kuechen-status?location_id=${locationId}`);
        if (r.ok && !cancelled) {
          const j: KuechenStatusData = await r.json();
          setData(j);
        }
      } catch { /* silent */ }
    };

    load();
    const iv = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!mounted || closed) return null;

  const cfg = STATUS_CONFIG[data.status];

  return (
    <div className={cn(
      'flex items-center gap-2 rounded-full border px-3 py-1.5',
      cfg.bg, cfg.border, className,
    )}>
      <ChefHat className={cn('h-4 w-4 shrink-0', cfg.text)} />
      <span className="text-xs font-medium">{cfg.emoji}</span>
      <span className={cn('text-xs font-semibold', cfg.text)}>{cfg.label}</span>
      {data.eta_aufschlag_min > 0 && (
        <span className={cn('text-[10px] font-bold', cfg.text)}>
          +{data.eta_aufschlag_min} Min
        </span>
      )}
      <button
        onClick={() => setClosed(true)}
        className={cn('ml-auto p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10', cfg.text)}
        aria-label="Schließen"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
