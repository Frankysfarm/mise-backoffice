'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronDown, ChevronUp, ClipboardList, Clock, Flame } from 'lucide-react';

/**
 * Phase 1777 — Live-Kochplan-Optimierer (Kitchen)
 *
 * Aktive Bestellungen sortiert nach Dringlichkeit (ETA + Komplexität);
 * Drag-Hinweis; Alert überfällig; useMemo; Collapsible.
 */

interface Order {
  id: string;
  order_number?: string;
  status?: string;
  created_at?: string;
  estimated_delivery_at?: string;
  items?: Array<{ name?: string; quantity?: number }>;
}

interface Props {
  orders: Order[];
  className?: string;
}

interface KochplanEintrag {
  id: string;
  order_number: string;
  dringlichkeit: 'kritisch' | 'hoch' | 'normal';
  minuten_verbleibend: number | null;
  artikel_anzahl: number;
  artikel_vorschau: string;
  ist_ueberfaellig: boolean;
}

function bewerteDringlichkeit(
  minuten: number | null,
  artikelAnzahl: number,
): KochplanEintrag['dringlichkeit'] {
  if (minuten !== null && minuten <= 10) return 'kritisch';
  if (minuten !== null && minuten <= 20) return 'hoch';
  if (artikelAnzahl >= 5) return 'hoch';
  return 'normal';
}

export function KitchenPhase1777LiveKochplanOptimierer({ orders, className }: Props) {
  const [open, setOpen] = useState(true);

  const eintraege = useMemo<KochplanEintrag[]>(() => {
    const aktiv = orders.filter(
      (o) => o.status === 'accepted' || o.status === 'preparing' || o.status === 'in_progress',
    );

    const now = Date.now();

    const mapped: KochplanEintrag[] = aktiv.map((o) => {
      const eta = o.estimated_delivery_at ? new Date(o.estimated_delivery_at).getTime() : null;
      const minuten_verbleibend = eta !== null ? Math.round((eta - now) / 60000) : null;
      const artikel_anzahl = (o.items ?? []).reduce((s, i) => s + (i.quantity ?? 1), 0);
      const artikel_vorschau =
        (o.items ?? [])
          .slice(0, 3)
          .map((i) => `${i.quantity ?? 1}× ${i.name ?? '?'}`)
          .join(', ') + ((o.items?.length ?? 0) > 3 ? ' …' : '');

      return {
        id: o.id,
        order_number: o.order_number ?? o.id.slice(0, 6).toUpperCase(),
        dringlichkeit: bewerteDringlichkeit(minuten_verbleibend, artikel_anzahl),
        minuten_verbleibend,
        artikel_anzahl,
        artikel_vorschau,
        ist_ueberfaellig: minuten_verbleibend !== null && minuten_verbleibend < 0,
      };
    });

    // Sortierung: überfällig → kritisch → hoch → normal, dann nach Zeit
    mapped.sort((a, b) => {
      if (a.ist_ueberfaellig !== b.ist_ueberfaellig) return a.ist_ueberfaellig ? -1 : 1;
      const dringlichkeitsOrder = { kritisch: 0, hoch: 1, normal: 2 };
      const dDiff = dringlichkeitsOrder[a.dringlichkeit] - dringlichkeitsOrder[b.dringlichkeit];
      if (dDiff !== 0) return dDiff;
      const aMin = a.minuten_verbleibend ?? 999;
      const bMin = b.minuten_verbleibend ?? 999;
      return aMin - bMin;
    });

    return mapped;
  }, [orders]);

  const ueberfaelligCount = eintraege.filter((e) => e.ist_ueberfaellig).length;

  if (eintraege.length === 0) return null;

  const styleMap = {
    kritisch: {
      row: 'bg-red-50 dark:bg-red-950/30 border-l-4 border-red-500',
      badge: 'bg-red-500 text-white',
      label: 'Kritisch',
    },
    hoch: {
      row: 'bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-400',
      badge: 'bg-amber-400 text-white',
      label: 'Hoch',
    },
    normal: {
      row: 'bg-white dark:bg-muted/20 border-l-4 border-transparent',
      badge: 'bg-muted text-muted-foreground',
      label: 'Normal',
    },
  };

  return (
    <div className={cn('rounded-xl border bg-card shadow-sm overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition"
      >
        <ClipboardList className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground flex-1 text-left">
          Live-Kochplan · Dringlichkeitsreihenfolge
        </span>
        {ueberfaelligCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
            <AlertTriangle className="h-3 w-3" />
            {ueberfaelligCount} überfällig
          </span>
        )}
        <span className="text-[10px] text-muted-foreground font-medium">
          {eintraege.length} aktiv
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div>
          {/* Drag-Hinweis */}
          <div className="px-4 py-1.5 bg-muted/30 border-b text-[10px] text-muted-foreground flex items-center gap-1">
            <Flame className="h-3 w-3 text-amber-400" />
            Reihenfolge nach Dringlichkeit — oben zuerst zubereiten
          </div>

          {/* Bestellungsliste */}
          <div className="divide-y">
            {eintraege.map((e, idx) => {
              const s = styleMap[e.dringlichkeit];
              return (
                <div key={e.id} className={cn('px-4 py-2.5 flex items-center gap-3', s.row)}>
                  {/* Rang */}
                  <div className="shrink-0 w-5 text-center text-[10px] font-black text-muted-foreground">
                    {idx + 1}
                  </div>

                  {/* Dringlichkeits-Badge */}
                  <div className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black min-w-[52px] text-center', s.badge)}>
                    {e.ist_ueberfaellig ? '⚠ Überfällig' : s.label}
                  </div>

                  {/* Bestell-Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold">#{e.order_number}</span>
                      <span className="text-[10px] text-muted-foreground truncate">{e.artikel_vorschau}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">{e.artikel_anzahl} Artikel</div>
                  </div>

                  {/* ETA */}
                  <div className="shrink-0 text-right">
                    {e.minuten_verbleibend !== null ? (
                      <>
                        <div className={cn(
                          'font-mono text-sm font-black tabular-nums',
                          e.ist_ueberfaellig ? 'text-red-600' :
                          e.dringlichkeit === 'kritisch' ? 'text-red-500' :
                          e.dringlichkeit === 'hoch' ? 'text-amber-600' : 'text-matcha-600',
                        )}>
                          {e.ist_ueberfaellig ? `+${Math.abs(e.minuten_verbleibend)}` : e.minuten_verbleibend}m
                        </div>
                        <div className="flex items-center justify-end gap-0.5 text-[8px] text-muted-foreground">
                          <Clock className="h-2.5 w-2.5" />
                          {e.ist_ueberfaellig ? 'überfällig' : 'verbleibend'}
                        </div>
                      </>
                    ) : (
                      <div className="text-[10px] text-muted-foreground">–</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
