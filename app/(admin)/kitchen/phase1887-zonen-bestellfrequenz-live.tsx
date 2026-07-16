'use client';

/**
 * Phase 1887 — Zonen-Bestellfrequenz-Live (Kitchen)
 *
 * Bestellungen je Zone in den letzten 30 Min als Mini-Balken.
 * Trend-Pfeil: Vergleich mit vorherigen 30 Min.
 * Echtzeit aus props orders. useMemo. Collapsible.
 */

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Activity, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Order {
  id: string;
  status?: string | null;
  delivery_zone?: string | null;
  created_at?: string | null;
}

interface Props {
  orders: Order[];
  className?: string;
}

const ZONEN = ['A', 'B', 'C', 'D'] as const;
type Zone = (typeof ZONEN)[number];

const ZONE_LABEL: Record<Zone, string> = { A: 'Nah', B: 'Standard', C: 'Weit', D: 'Außen' };

interface ZoneFrequenz {
  zone: Zone;
  letzteMin: number;
  vorherige: number;
  gesamt: number;
  trend: 'steigend' | 'stabil' | 'fallend';
}

const TREND_ICON  = { steigend: TrendingUp, stabil: Minus, fallend: TrendingDown };
const TREND_COLOR = {
  steigend: 'text-matcha-600 dark:text-matcha-400',
  stabil:   'text-amber-600 dark:text-amber-400',
  fallend:  'text-red-600 dark:text-red-400',
};
const BAR_COLOR: Record<Zone, string> = {
  A: 'bg-matcha-500',
  B: 'bg-blue-500',
  C: 'bg-amber-500',
  D: 'bg-purple-500',
};

export function KitchenPhase1887ZonenBestellfrequenzLive({ orders, className }: Props) {
  const [offen, setOffen] = useState(true);

  const frequenzen = useMemo<ZoneFrequenz[]>(() => {
    const jetzt = Date.now();
    const vor30 = jetzt - 30 * 60 * 1000;
    const vor60 = jetzt - 60 * 60 * 1000;

    return ZONEN.map((zone) => {
      const alle = orders.filter(
        (o) => (o.delivery_zone ?? 'A').toUpperCase() === zone,
      );
      const letzteMin = alle.filter((o) => {
        if (!o.created_at) return false;
        const t = new Date(o.created_at).getTime();
        return t >= vor30 && t <= jetzt;
      }).length;
      const vorherige = alle.filter((o) => {
        if (!o.created_at) return false;
        const t = new Date(o.created_at).getTime();
        return t >= vor60 && t < vor30;
      }).length;

      const trend: ZoneFrequenz['trend'] =
        letzteMin > vorherige + 1 ? 'steigend' :
        letzteMin < vorherige - 1 ? 'fallend'  : 'stabil';

      return { zone, letzteMin, vorherige, gesamt: alle.length, trend };
    });
  }, [orders]);

  const maxFreq = Math.max(...frequenzen.map((z) => z.letzteMin), 1);
  const gesamtLetzteMin = frequenzen.reduce((s, z) => s + z.letzteMin, 0);
  const aktivZonen = frequenzen.filter((z) => z.letzteMin > 0).length;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Activity className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Zonen-Frequenz · letzte 30 Min</span>
        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
          {gesamtLetzteMin} Bst. in {aktivZonen} Zonen
        </span>
        {offen
          ? <ChevronUp className="ml-1 h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="ml-1 h-4 w-4 text-muted-foreground" />}
      </button>

      {offen && (
        <div className="p-4 space-y-2.5">
          {frequenzen.map((z) => {
            const barPct = Math.round((z.letzteMin / maxFreq) * 100);
            const TIcon  = TREND_ICON[z.trend];

            return (
              <div key={z.zone} className="space-y-1">
                {/* Zone Header */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white shrink-0',
                      BAR_COLOR[z.zone],
                    )}>
                      {z.zone}
                    </span>
                    <span className="font-semibold text-foreground">Zone {z.zone}</span>
                    <span className="text-[10px] text-muted-foreground">{ZONE_LABEL[z.zone]}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TIcon className={cn('h-3.5 w-3.5', TREND_COLOR[z.trend])} />
                    <span className="font-black tabular-nums">
                      {z.letzteMin}
                      <span className="font-normal text-muted-foreground text-[10px]"> Bst.</span>
                    </span>
                  </div>
                </div>

                {/* Balken */}
                <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', BAR_COLOR[z.zone])}
                    style={{ width: `${barPct}%` }}
                  />
                </div>

                {/* Vergleich */}
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Vorh. 30 Min: {z.vorherige}</span>
                  <span>Gesamt heute: {z.gesamt}</span>
                </div>
              </div>
            );
          })}

          <p className="text-[10px] text-muted-foreground text-right pt-1">
            Echtzeit aus Bestellungen · aktualisiert bei Reload
          </p>
        </div>
      )}
    </div>
  );
}
