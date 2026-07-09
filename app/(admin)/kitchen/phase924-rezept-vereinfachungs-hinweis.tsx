'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, X, Zap } from 'lucide-react';

/**
 * Phase 924 — Rezept-Vereinfachungs-Hinweis (Kitchen)
 *
 * Warnt wenn derselbe Artikel in >3 aktiven Bestellungen vorkommt
 * und schlägt Parallel-Kochen vor. Client-seitig, kein API-Call.
 */

interface OrderItem {
  name?: string | null;
  title?: string | null;
  quantity?: number | null;
  menge?: number | null;
}

interface Order {
  id: string;
  bestellnummer?: string | null;
  status: string;
  items?: OrderItem[];
  artikel?: OrderItem[];
}

interface Props {
  orders: Order[];
}

const AKTIVE_STATI = ['in_zubereitung', 'bestätigt', 'confirmed', 'neu', 'pending'];

interface ArtikelHinweis {
  name: string;
  anzahlBestellungen: number;
  gesamtMenge: number;
}

const SCHWELLWERT = 3;

export function KitchenPhase924RezeptVereinfachungsHinweis({ orders }: Props) {
  const [dismissed, setDismissed] = useState(false);

  const hinweise = useMemo((): ArtikelHinweis[] => {
    const aktiv = orders.filter((o) => AKTIVE_STATI.includes(o.status));
    const counter = new Map<string, { bestellungen: Set<string>; menge: number }>();

    for (const order of aktiv) {
      const items = (order.items ?? order.artikel ?? []) as OrderItem[];
      const seenInOrder = new Set<string>();

      for (const it of items) {
        const name = ((it.name ?? it.title) ?? '').trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (!counter.has(key)) counter.set(key, { bestellungen: new Set(), menge: 0 });
        const entry = counter.get(key)!;
        entry.bestellungen.add(order.id);
        if (!seenInOrder.has(key)) {
          const menge = Number(it.quantity ?? it.menge ?? 1);
          entry.menge += menge;
          seenInOrder.add(key);
        }
      }
    }

    const result: ArtikelHinweis[] = [];
    for (const [, { bestellungen, menge }] of counter) {
      if (bestellungen.size > SCHWELLWERT) {
        const name = [...counter.entries()].find(([, v]) => v.bestellungen === bestellungen)?.[0] ?? '';
        result.push({ name, anzahlBestellungen: bestellungen.size, gesamtMenge: menge });
      }
    }

    // Build proper name map
    const nameMap = new Map<string, string>();
    for (const order of aktiv) {
      const items = (order.items ?? order.artikel ?? []) as OrderItem[];
      for (const it of items) {
        const name = ((it.name ?? it.title) ?? '').trim();
        if (name) nameMap.set(name.toLowerCase(), name);
      }
    }

    return [...counter.entries()]
      .filter(([, v]) => v.bestellungen.size > SCHWELLWERT)
      .map(([key, v]) => ({
        name: nameMap.get(key) ?? key,
        anzahlBestellungen: v.bestellungen.size,
        gesamtMenge: v.menge,
      }))
      .sort((a, b) => b.anzahlBestellungen - a.anzahlBestellungen)
      .slice(0, 5);
  }, [orders]);

  if (dismissed || hinweise.length === 0) return null;

  return (
    <div className="rounded-2xl border-2 border-matcha-300 bg-matcha-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-matcha-200">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 shrink-0">
            <ChefHat className="h-4 w-4 text-matcha-700" />
          </div>
          <div>
            <div className="text-sm font-bold text-matcha-900">Parallel-Kochen empfohlen</div>
            <div className="text-xs text-matcha-600">
              {hinweise.length} Artikel in mehreren Bestellungen — Batch-Zubereitung spart Zeit
            </div>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-matcha-400 hover:text-matcha-700 transition-colors p-1"
          aria-label="Schließen"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="divide-y divide-matcha-100">
        {hinweise.map((h) => (
          <div key={h.name} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <Zap className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
              <span className="text-sm font-semibold text-char truncate">{h.name}</span>
            </div>
            <div className={cn(
              'flex items-center gap-1.5 shrink-0 ml-3',
            )}>
              <span className="rounded-full bg-matcha-100 px-2.5 py-0.5 text-xs font-bold text-matcha-800">
                {h.anzahlBestellungen}× Bestellungen
              </span>
              <span className="text-xs text-stone-400">
                {h.gesamtMenge}× gesamt
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-2.5 bg-matcha-100/60">
        <p className="text-xs text-matcha-700 font-medium">
          Tipp: Alle {hinweise[0]?.name}-Portionen auf einmal zubereiten — dann auf Bestellungen aufteilen.
        </p>
      </div>
    </div>
  );
}
