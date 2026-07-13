'use client';

// Phase 1320 — Rezept-Skalierungs-Helfer (Kitchen)
// Zeigt welche Gerichte die Küche für die nächsten 30 Min vorbereiten sollte,
// basierend auf der Bestellqueue. Props-basiert. Nach Phase1315.

import { useMemo } from 'react';
import { ChefHat, Clock, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface OrderItem {
  name?: string;
  menge?: number;
  quantity?: number;
}

interface Order {
  id: string;
  status?: string;
  items?: OrderItem[];
  created_at?: string;
  geschaetzte_zubereitung_min?: number;
}

interface Props {
  orders: Order[];
}

interface GerichtBedarf {
  name: string;
  anzahl: number;
  empfehlung: 'jetzt_vorkochen' | 'bald_benoetigt' | 'ausreichend';
}

const AKTIV_STATUS = new Set(['waiting', 'pending', 'preparing', 'accepted', 'confirmed']);

const EMPFEHLUNG_STYLE: Record<GerichtBedarf['empfehlung'], { label: string; bg: string; border: string; badge: string }> = {
  jetzt_vorkochen: { label: 'Jetzt vorkochen!', bg: 'bg-red-50 dark:bg-red-950/20',   border: 'border-red-200 dark:border-red-800',   badge: 'bg-red-500 text-white'   },
  bald_benoetigt:  { label: 'Bald benötigt',    bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-200 dark:border-amber-800', badge: 'bg-amber-400 text-white' },
  ausreichend:     { label: 'Ausreichend',       bg: 'bg-matcha-50 dark:bg-matcha-950/20', border: 'border-matcha-200 dark:border-matcha-800', badge: 'bg-matcha-500 text-white' },
};

export function KitchenPhase1320RezeptSkalierungsHelfer({ orders }: Props) {
  const bedarfListe = useMemo((): GerichtBedarf[] => {
    const aktiv = orders.filter((o) => AKTIV_STATUS.has(o.status ?? ''));
    if (aktiv.length === 0) return [];

    const zähler: Record<string, number> = {};
    for (const order of aktiv) {
      for (const item of order.items ?? []) {
        const name = item.name ?? 'Unbekannt';
        const menge = item.menge ?? item.quantity ?? 1;
        zähler[name] = (zähler[name] ?? 0) + menge;
      }
    }

    return Object.entries(zähler)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, anzahl]): GerichtBedarf => ({
        name,
        anzahl,
        empfehlung: anzahl >= 4 ? 'jetzt_vorkochen' : anzahl >= 2 ? 'bald_benoetigt' : 'ausreichend',
      }));
  }, [orders]);

  const dringend = bedarfListe.filter((b) => b.empfehlung === 'jetzt_vorkochen');

  if (bedarfListe.length === 0) {
    return (
      <Card className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
        <ChefHat className="h-4 w-4" />
        Keine aktiven Bestellungen — Küche bereit.
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <ChefHat className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Rezept-Skalierungs-Helfer</span>
        <div className="flex items-center gap-1 ml-auto text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          Nächste 30 Min
        </div>
        {dringend.length > 0 && (
          <Badge className="bg-red-500 text-white text-[10px]">
            {dringend.length} dringend
          </Badge>
        )}
      </div>

      <div className="px-4 py-3 space-y-2">
        {bedarfListe.map((b) => {
          const style = EMPFEHLUNG_STYLE[b.empfehlung];
          return (
            <div
              key={b.name}
              className={cn('flex items-center gap-3 rounded-lg border px-3 py-2', style.bg, style.border)}
            >
              {/* Mengen-Badge */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background/60 border border-inherit">
                <span className="text-sm font-black tabular-nums">{b.anzahl}×</span>
              </div>

              {/* Name */}
              <span className="flex-1 text-sm font-semibold truncate">{b.name}</span>

              {/* Empfehlung */}
              <Badge className={cn('shrink-0 text-[10px]', style.badge)}>
                {b.empfehlung === 'jetzt_vorkochen' && <TrendingUp className="h-2.5 w-2.5 mr-1" />}
                {style.label}
              </Badge>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
