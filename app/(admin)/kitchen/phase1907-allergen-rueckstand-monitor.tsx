'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';

/**
 * Phase 1907 — Allergen-Rückstand-Monitor (Kitchen)
 *
 * Bestellungen mit kritischen Allergenen (Nüsse/Fisch/Gluten) die >20 Min warten.
 * Alarm-Banner; Prioritäts-Markierung. useMemo; Collapsible.
 */

const KRITISCHE_ALLERGENE = ['nüsse', 'fisch', 'gluten', 'laktose', 'nuts', 'fish', 'gluten', 'lactose'] as const;
const SCHWELLE_MIN = 20;

interface OrderItem {
  name?: string;
  allergene?: string[];
  allergens?: string[];
}

interface Order {
  id: string;
  status?: string;
  created_at?: string;
  customer_name?: string;
  items?: OrderItem[];
  bestellnummer?: string;
}

interface AllergenBestellung {
  id: string;
  bestellnummer: string;
  wartezeit_min: number;
  customer_name: string;
  allergene: string[];
}

interface Props {
  orders: Order[];
  schwelle?: number;
  className?: string;
}

function extractAllergene(items: OrderItem[] | undefined): string[] {
  if (!items) return [];
  const gefunden = new Set<string>();
  for (const item of items) {
    const alle = [...(item.allergene ?? []), ...(item.allergens ?? [])];
    for (const a of alle) {
      const lower = a.toLowerCase();
      if (KRITISCHE_ALLERGENE.some((k) => lower.includes(k))) {
        gefunden.add(lower);
      }
    }
  }
  return Array.from(gefunden);
}

export function KitchenPhase1907AllergenRueckstandMonitor({ orders, schwelle = SCHWELLE_MIN, className }: Props) {
  const [offen, setOffen] = useState(true);

  const bestellungen = useMemo<AllergenBestellung[]>(() => {
    const jetzt = Date.now();
    const liste: AllergenBestellung[] = [];

    for (const o of orders) {
      if (o.status !== 'preparing' && o.status !== 'in_preparation' && o.status !== 'new' && o.status !== 'accepted') continue;
      if (!o.created_at) continue;

      const allergene = extractAllergene(o.items);
      if (allergene.length === 0) continue;

      const wartezeit_min = Math.floor((jetzt - new Date(o.created_at).getTime()) / 60_000);
      if (wartezeit_min < schwelle) continue;

      liste.push({
        id: o.id,
        bestellnummer: o.bestellnummer ?? o.id.slice(-4),
        wartezeit_min,
        customer_name: o.customer_name ?? `#${o.id.slice(-4)}`,
        allergene,
      });
    }

    return liste.sort((a, b) => b.wartezeit_min - a.wartezeit_min);
  }, [orders, schwelle]);

  const hatAlarm = bestellungen.length > 0;

  function allergenLabel(a: string): string {
    if (a.includes('nüsse') || a.includes('nuts')) return '🥜 Nüsse';
    if (a.includes('fisch') || a.includes('fish')) return '🐟 Fisch';
    if (a.includes('gluten')) return '🌾 Gluten';
    if (a.includes('laktose') || a.includes('lactose')) return '🥛 Laktose';
    return a;
  }

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <ShieldAlert
          className={cn('h-4 w-4 shrink-0', hatAlarm ? 'text-red-500' : 'text-green-500')}
        />
        <span className="text-xs font-bold uppercase tracking-wider">Allergen-Rückstand</span>
        {hatAlarm ? (
          <span className="ml-1 text-[10px] font-bold rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5">
            {bestellungen.length} Alarm{bestellungen.length !== 1 ? 'e' : ''}
          </span>
        ) : (
          <span className="ml-1 text-[10px] font-bold rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5">
            Alles OK
          </span>
        )}
        {offen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
        )}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          {/* Alarm-Banner */}
          {hatAlarm && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-700 dark:text-red-300">
                  {bestellungen.length} Allergen-Bestellung{bestellungen.length !== 1 ? 'en' : ''} im Rückstand
                </p>
                <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5">
                  Bestellungen mit kritischen Allergenen über {schwelle} Min — sofort priorisieren!
                </p>
              </div>
            </div>
          )}

          {/* Bestellungsliste */}
          {bestellungen.length > 0 && (
            <div className="space-y-1.5">
              {bestellungen.map((b) => (
                <div
                  key={b.id}
                  className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/10 px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-black bg-red-500 text-white rounded px-1.5 py-0.5 shrink-0">
                        #{b.bestellnummer}
                      </span>
                      <span className="text-xs font-medium truncate">{b.customer_name}</span>
                    </div>
                    <span
                      className={cn(
                        'text-xs font-black tabular-nums shrink-0',
                        b.wartezeit_min >= 45
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-amber-600 dark:text-amber-400',
                      )}
                    >
                      {b.wartezeit_min} Min
                    </span>
                  </div>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {b.allergene.map((a) => (
                      <span
                        key={a}
                        className="text-[10px] font-semibold rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5"
                      >
                        {allergenLabel(a)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!hatAlarm && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Keine kritischen Allergen-Rückstände ✓
            </p>
          )}

          <p className="text-[10px] text-muted-foreground text-right">
            Schwelle: Allergene über {schwelle} Min · Echtzeit
          </p>
        </div>
      )}
    </div>
  );
}
