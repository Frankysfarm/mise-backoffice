'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronDown, ChevronUp, FlaskConical } from 'lucide-react';

/**
 * Phase 1797 — Rezept-Kompatibilitäts-Prüfer (Kitchen)
 *
 * Prüft aktive Bestellungen auf Allergen-Konflikte + Zubereitungszeit-Überschneidungen.
 * Alert bei Konflikt; useMemo; Collapsible; Props orders.
 */

interface OrderItem {
  name?: string;
  title?: string;
  allergens?: string[];
  prep_time_min?: number;
  quantity?: number;
}

interface Order {
  id?: string;
  status?: string;
  items?: OrderItem[];
  order_items?: OrderItem[];
  scheduled_at?: string;
  eta_min?: number;
}

interface Props {
  orders: Order[];
  className?: string;
}

interface KonfliktInfo {
  bestellung_id: string;
  art: 'allergen' | 'timing';
  beschreibung: string;
  schwere: 'kritisch' | 'hinweis';
}

const BEKANNTE_ALLERGENE = ['Gluten', 'Laktose', 'Nüsse', 'Erdnüsse', 'Ei', 'Fisch', 'Soja', 'Sellerie'];
const MAX_PARALLELE_ZUBEREITUNGEN = 4;

function findKonflikte(orders: Order[]): KonfliktInfo[] {
  const konflikte: KonfliktInfo[] = [];
  const aktive = orders.filter(o =>
    ['accepted', 'preparing', 'in_progress', 'pending'].includes(o.status ?? ''),
  );

  // Allergen-Konflikt: mehrere Bestellungen mit gleichen Allergenen gleichzeitig
  const allergenCounts: Record<string, number> = {};
  for (const o of aktive) {
    const items = o.items ?? o.order_items ?? [];
    for (const item of items) {
      for (const a of (item.allergens ?? [])) {
        allergenCounts[a] = (allergenCounts[a] ?? 0) + 1;
      }
    }
  }

  for (const [allergen, count] of Object.entries(allergenCounts)) {
    if (count > 1 && BEKANNTE_ALLERGENE.includes(allergen)) {
      konflikte.push({
        bestellung_id: 'multi',
        art: 'allergen',
        beschreibung: `Allergen „${allergen}" in ${count} parallelen Bestellungen — Kontaminationsrisiko`,
        schwere: 'kritisch',
      });
    }
  }

  // Timing-Konflikt: mehr als MAX_PARALLELE_ZUBEREITUNGEN gleichzeitig mit langer Zubereitungszeit
  const langeDauer = aktive.filter(o => {
    const items = o.items ?? o.order_items ?? [];
    const maxPrepTime = items.reduce((m, i) => Math.max(m, i.prep_time_min ?? 0), 0);
    return maxPrepTime >= 20;
  });

  if (langeDauer.length >= MAX_PARALLELE_ZUBEREITUNGEN) {
    konflikte.push({
      bestellung_id: 'timing',
      art: 'timing',
      beschreibung: `${langeDauer.length} Bestellungen mit ≥20 Min Zubereitungszeit gleichzeitig — Küchen-Engpass möglich`,
      schwere: 'hinweis',
    });
  }

  return konflikte;
}

export function KitchenPhase1797RezeptKompatibilitaetsPruefer({ orders, className }: Props) {
  const [open, setOpen] = useState(true);

  const { konflikte, aktiveAnzahl } = useMemo(() => {
    const aktive = orders.filter(o =>
      ['accepted', 'preparing', 'in_progress', 'pending'].includes(o.status ?? ''),
    );
    return {
      konflikte: findKonflikte(orders),
      aktiveAnzahl: aktive.length,
    };
  }, [orders]);

  const kritische = konflikte.filter(k => k.schwere === 'kritisch');
  const hinweise = konflikte.filter(k => k.schwere === 'hinweis');
  const hatKritisch = kritische.length > 0;

  return (
    <div className={cn('rounded-xl border border-border bg-card mb-3', className)}>
      <button
        className="flex w-full items-center justify-between px-4 py-3"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-saffron" />
          <span className="text-sm font-bold">Rezept-Kompatibilität</span>
          {konflikte.length > 0 ? (
            <span className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
              hatKritisch
                ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
            )}>
              <AlertTriangle className="h-3 w-3" />
              {konflikte.length} Konflikt{konflikte.length > 1 ? 'e' : ''}
            </span>
          ) : (
            <span className="rounded-full bg-matcha-100 dark:bg-matcha-900/40 px-2 py-0.5 text-[10px] font-bold text-matcha-700 dark:text-matcha-300">
              Alles kompatibel
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {hatKritisch && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <p className="text-xs font-bold text-red-800 dark:text-red-200">
                {kritische.length} kritischer Allergen-Konflikt{kritische.length > 1 ? 'e' : ''} — bitte sofort prüfen!
              </p>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">Aktive Bestellungen</span>
            <span className="text-sm font-black tabular-nums text-foreground">{aktiveAnzahl}</span>
          </div>

          {konflikte.length === 0 ? (
            <div className="rounded-lg bg-matcha-50 dark:bg-matcha-900/20 border border-matcha-200 dark:border-matcha-800 px-3 py-3 text-center">
              <p className="text-xs font-bold text-matcha-700 dark:text-matcha-300">
                Keine Allergen-Konflikte oder Timing-Probleme erkannt.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {kritische.map((k, i) => (
                <div
                  key={`k-${i}`}
                  className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 px-3 py-2.5"
                >
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black uppercase text-red-600 dark:text-red-400 tracking-wide">Kritisch</p>
                    <p className="text-xs text-red-800 dark:text-red-200">{k.beschreibung}</p>
                  </div>
                </div>
              ))}
              {hinweise.map((h, i) => (
                <div
                  key={`h-${i}`}
                  className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 px-3 py-2.5"
                >
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wide">Hinweis</p>
                    <p className="text-xs text-amber-800 dark:text-amber-200">{h.beschreibung}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
