'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Lightbulb, ArrowRight, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Phase 1482 — Reihenfolge-Optimierungs-Hinweis (Kitchen)
// Welche Bestellung als nächstes starten (basierend auf ETA + Lieferzone).
// Props-basiert. Nach Phase 1477.

interface Order {
  id: string;
  status: string;
  bestellnummer?: string | null;
  created_at?: string | null;
  lieferzone?: string | null;
  eta_minuten?: number | null;
  artikel_anzahl?: number | null;
}

interface Props {
  orders: Order[];
}

const WARTEND_STATUS = ['neu', 'bestaetigt', 'wartend'];

function calcPrioritaet(o: Order, now: number): number {
  const etaFaktor = o.eta_minuten != null ? Math.max(0, 60 - o.eta_minuten) : 0;
  const alterMin = o.created_at ? (now - new Date(o.created_at).getTime()) / 60_000 : 0;
  const alterFaktor = Math.min(alterMin * 2, 80);
  const zoneFaktor = o.lieferzone ? 10 : 0;
  return etaFaktor + alterFaktor + zoneFaktor;
}

export function KitchenPhase1482ReihenfolgeOptimierungsHinweis({ orders }: Props) {
  const now = Date.now();

  const sortiert = useMemo(() => {
    const wartend = orders.filter((o) => WARTEND_STATUS.includes(o.status));
    return [...wartend].sort((a, b) => calcPrioritaet(b, now) - calcPrioritaet(a, now));
  }, [orders]);

  if (sortiert.length === 0) return null;

  const top = sortiert[0];
  const rest = sortiert.slice(1, 3);

  const alterMin = top.created_at
    ? Math.round((now - new Date(top.created_at).getTime()) / 60_000)
    : null;

  return (
    <Card className="overflow-hidden border border-indigo-200 dark:border-indigo-800">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-800">
        <Lightbulb className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-200">
          Reihenfolge-Optimierung
        </span>
        <span className="ml-auto text-[10px] font-semibold text-indigo-500 dark:text-indigo-400">
          {sortiert.length} wartend
        </span>
      </div>

      {/* Empfohlene nächste Bestellung */}
      <div className="px-4 py-3 flex items-start gap-3">
        <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-black">
          1
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-foreground truncate">
              #{top.bestellnummer ?? top.id.slice(0, 8)}
            </span>
            <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40 rounded px-1.5 py-0.5">
              JETZT STARTEN
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {top.lieferzone && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {top.lieferzone}
              </span>
            )}
            {top.eta_minuten != null && (
              <span className="text-[10px] text-muted-foreground">ETA {top.eta_minuten} Min</span>
            )}
            {alterMin != null && (
              <span className={cn('text-[10px] font-medium', alterMin >= 20 ? 'text-rose-500' : 'text-muted-foreground')}>
                Wartet {alterMin} Min
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Nächste 2 */}
      {rest.length > 0 && (
        <div className="border-t border-indigo-100 dark:border-indigo-900/40 divide-y divide-indigo-100 dark:divide-indigo-900/40">
          {rest.map((o, idx) => {
            const oAlterMin = o.created_at
              ? Math.round((now - new Date(o.created_at).getTime()) / 60_000)
              : null;
            return (
              <div key={o.id} className="px-4 py-2 flex items-center gap-2">
                <span className="text-[10px] font-black text-muted-foreground w-4 text-center">{idx + 2}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                <span className="text-xs font-semibold text-foreground flex-1 truncate">
                  #{o.bestellnummer ?? o.id.slice(0, 8)}
                </span>
                {o.lieferzone && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <MapPin className="h-3 w-3" />
                    {o.lieferzone}
                  </span>
                )}
                {oAlterMin != null && (
                  <span className={cn('text-[10px] font-medium', oAlterMin >= 20 ? 'text-amber-500' : 'text-muted-foreground')}>
                    {oAlterMin} Min
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
