'use client';

import { useMemo } from 'react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Activity, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Phase 1728 — Schicht-Produktivitäts-Ampel (Kitchen)
 *
 * Ø Bestellungen/h heute vs. Ziel-Stunden-Durchsatz.
 * Trend-Pfeil + Ampel grün/gelb/rot. Props-basiert, useMemo.
 */

interface OrderItem {
  id: string;
  name?: string | null;
}

interface Order {
  id: string;
  status: string;
  bestellt_am?: string | null;
  created_at?: string | null;
  items?: OrderItem[] | null;
}

interface Props {
  orders: Order[];
  ziel_bestellungen_pro_h?: number;
}

type AmpelFarbe = 'gruen' | 'gelb' | 'rot';

const DONE_STATUS = new Set(['delivered', 'geliefert', 'completed', 'abgeschlossen', 'done']);

export function KitchenPhase1728SchichtProduktivitaetsAmpel({
  orders,
  ziel_bestellungen_pro_h = 8,
}: Props) {
  const [open, setOpen] = useState(true);

  const { istProH, trendProH, farbe, schichtStunden, bestellungenHeute } = useMemo(() => {
    const now = Date.now();
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const schichtStart = todayMidnight.getTime();
    const schichtStunden = Math.max(0.5, (now - schichtStart) / 3_600_000);

    const heute = orders.filter(o => {
      const ts = o.bestellt_am ?? o.created_at;
      return ts && new Date(ts).getTime() >= schichtStart;
    });

    const ersteHaelfte = heute.filter(o => {
      const ts = o.bestellt_am ?? o.created_at;
      return ts && new Date(ts).getTime() < schichtStart + schichtStunden * 1_800_000;
    });
    const zweiteHaelfte = heute.filter(o => {
      const ts = o.bestellt_am ?? o.created_at;
      return ts && new Date(ts).getTime() >= schichtStart + schichtStunden * 1_800_000;
    });

    const h1 = schichtStunden / 2;
    const h2 = schichtStunden / 2;
    const rateErstes = ersteHaelfte.length / Math.max(0.5, h1);
    const rateZweites = zweiteHaelfte.length / Math.max(0.5, h2);

    const istProH = Math.round((heute.length / schichtStunden) * 10) / 10;
    const trendProH = Math.round((rateZweites - rateErstes) * 10) / 10;

    const ratio = istProH / ziel_bestellungen_pro_h;
    const farbe: AmpelFarbe = ratio >= 0.9 ? 'gruen' : ratio >= 0.6 ? 'gelb' : 'rot';

    return { istProH, trendProH, farbe, schichtStunden: Math.round(schichtStunden * 10) / 10, bestellungenHeute: heute.length };
  }, [orders, ziel_bestellungen_pro_h]);

  const farbenKlassen: Record<AmpelFarbe, { border: string; bg: string; text: string; badge: string }> = {
    gruen: {
      border: 'border-green-200 dark:border-green-800',
      bg: 'bg-green-50/30 dark:bg-green-950/10',
      text: 'text-green-700 dark:text-green-300',
      badge: 'bg-green-500 text-white',
    },
    gelb: {
      border: 'border-yellow-200 dark:border-yellow-700',
      bg: 'bg-yellow-50/30 dark:bg-yellow-950/10',
      text: 'text-yellow-700 dark:text-yellow-300',
      badge: 'bg-yellow-500 text-white',
    },
    rot: {
      border: 'border-red-200 dark:border-red-700',
      bg: 'bg-red-50/30 dark:bg-red-950/10',
      text: 'text-red-700 dark:text-red-300',
      badge: 'bg-red-500 text-white',
    },
  };

  const label: Record<AmpelFarbe, string> = {
    gruen: 'Auf Ziel',
    gelb: 'Unter Ziel',
    rot: 'Kritisch',
  };

  const k = farbenKlassen[farbe];

  return (
    <div className={cn('rounded-xl border p-3 mb-3', k.border, k.bg)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2"
      >
        <span className={cn('flex items-center gap-2 text-sm font-bold', k.text)}>
          <Activity className="h-4 w-4" />
          Schicht-Produktivität
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-black', k.badge)}>
            {label[farbe]}
          </span>
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-border/60 bg-background/60 p-2 text-center">
              <p className="text-[10px] text-muted-foreground">Ist (Best./h)</p>
              <p className={cn('text-lg font-black tabular-nums', k.text)}>{istProH}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/60 p-2 text-center">
              <p className="text-[10px] text-muted-foreground">Ziel</p>
              <p className="text-lg font-black tabular-nums text-foreground">{ziel_bestellungen_pro_h}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/60 p-2 text-center">
              <p className="text-[10px] text-muted-foreground">Trend</p>
              <span className={cn(
                'inline-flex items-center gap-0.5 text-lg font-black',
                trendProH > 0.5 ? 'text-green-600 dark:text-green-400'
                  : trendProH < -0.5 ? 'text-red-600 dark:text-red-400'
                  : 'text-muted-foreground',
              )}>
                {trendProH > 0.5 ? <TrendingUp className="h-4 w-4" />
                  : trendProH < -0.5 ? <TrendingDown className="h-4 w-4" />
                  : <Minus className="h-4 w-4" />}
                {trendProH > 0 ? '+' : ''}{trendProH}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Fortschritt zum Ziel</span>
              <span>{bestellungenHeute} Best. · {schichtStunden}h</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', {
                  'bg-green-500': farbe === 'gruen',
                  'bg-yellow-500': farbe === 'gelb',
                  'bg-red-500': farbe === 'rot',
                })}
                style={{ width: `${Math.min(100, Math.round((istProH / ziel_bestellungen_pro_h) * 100))}%` }}
              />
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground">
            Ø Bestellungen/h heute vs. Ziel {ziel_bestellungen_pro_h} Best./h
          </p>
        </div>
      )}
    </div>
  );
}
