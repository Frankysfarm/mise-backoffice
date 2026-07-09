'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Flame, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * Phase 1024 — Küchen-Priorisierungs-Assistent (Kitchen)
 *
 * Schlägt vor, welche Bestellungen als nächstes gestartet werden sollen,
 * basierend auf ETA-Dringlichkeit + Kochstation-Verfügbarkeit.
 * Rein client-seitig, useMemo.
 */

interface Order {
  id: string;
  bestellnummer?: string;
  status: string;
  promised_at?: string | null;
  created_at?: string | null;
  items?: Array<{ name?: string; title?: string; menge?: number }> | null;
}

interface Props {
  orders: Order[];
}

interface Empfehlung {
  orderId: string;
  bestellnummer: string;
  prioritaet: number;
  dringlichkeit: 'sofort' | 'bald' | 'normal';
  minuten_bis_deadline: number;
  station: string;
  station_emoji: string;
  artikel_anzahl: number;
  grund: string;
}

const STATION_KEYWORDS: Array<{ station: string; emoji: string; keywords: string[] }> = [
  { station: 'Grill', emoji: '🥩', keywords: ['burger', 'steak', 'grill', 'hähnchen', 'schnitzel', 'beef', 'bratwurst'] },
  { station: 'Friteuse', emoji: '🍟', keywords: ['pommes', 'fries', 'nuggets', 'chicken', 'wings', 'onion', 'frittiert'] },
  { station: 'Pasta/Pizza', emoji: '🍝', keywords: ['pasta', 'pizza', 'nudeln', 'spaghetti', 'carbonara', 'penne', 'sauce'] },
  { station: 'Salat/Bowl', emoji: '🥗', keywords: ['salat', 'bowl', 'wrap', 'veggie', 'vegan', 'caesar', 'garden'] },
  { station: 'Suppe/Curry', emoji: '🍲', keywords: ['suppe', 'curry', 'ramen', 'eintopf', 'chili', 'pho', 'brühe'] },
];

function detectStation(items: Order['items']): { station: string; emoji: string } {
  if (!items?.length) return { station: 'Allgemein', emoji: '🍽️' };
  const names = items.map(i => (i.name ?? i.title ?? '').toLowerCase()).join(' ');
  for (const s of STATION_KEYWORDS) {
    if (s.keywords.some(k => names.includes(k))) return { station: s.station, emoji: s.emoji };
  }
  return { station: 'Allgemein', emoji: '🍽️' };
}

function deadlineMinutes(order: Order): number {
  const base = order.promised_at
    ? new Date(order.promised_at).getTime()
    : new Date(order.created_at ?? Date.now()).getTime() + 35 * 60_000;
  return Math.round((base - Date.now()) / 60_000);
}

function dringlichkeit(min: number): Empfehlung['dringlichkeit'] {
  if (min <= 8) return 'sofort';
  if (min <= 18) return 'bald';
  return 'normal';
}

function dringlichkeitScore(d: Empfehlung['dringlichkeit']): number {
  return d === 'sofort' ? 100 : d === 'bald' ? 60 : 20;
}

function dringlichkeitStyle(d: Empfehlung['dringlichkeit']) {
  switch (d) {
    case 'sofort': return { badge: 'bg-red-100 dark:bg-red-900/30 border-red-300 text-red-700 dark:text-red-300', dot: 'bg-red-500', label: 'Sofort starten!' };
    case 'bald': return { badge: 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 text-amber-700 dark:text-amber-300', dot: 'bg-amber-500', label: 'Bald starten' };
    default: return { badge: 'bg-matcha-100 dark:bg-matcha-900/30 border-matcha-300 text-matcha-700 dark:text-matcha-300', dot: 'bg-matcha-500', label: 'Normal' };
  }
}

export function KitchenPhase1024PriorisierungsAssistent({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const empfehlungen = useMemo((): Empfehlung[] => {
    const wartend = orders.filter(o =>
      ['neu', 'bestätigt', 'confirmed', 'new'].includes(o.status)
    );

    return wartend
      .map((o): Empfehlung => {
        const min = deadlineMinutes(o);
        const d = dringlichkeit(min);
        const { station, emoji } = detectStation(o.items);
        const artikel = o.items?.reduce((s, i) => s + (i.menge ?? 1), 0) ?? 1;
        const grund =
          d === 'sofort' ? 'Deadline in weniger als 8 Min — sofortiger Kochstart erforderlich!'
          : d === 'bald' ? `Deadline in ${min} Min — Kochstart empfohlen`
          : `${min} Min bis Deadline — nach Prio-Bestellungen starten`;
        return {
          orderId: o.id,
          bestellnummer: o.bestellnummer ?? o.id.slice(0, 6),
          prioritaet: dringlichkeitScore(d) + Math.max(0, 100 - min),
          dringlichkeit: d,
          minuten_bis_deadline: min,
          station,
          station_emoji: emoji,
          artikel_anzahl: artikel,
          grund,
        };
      })
      .sort((a, b) => b.prioritaet - a.prioritaet)
      .slice(0, 8);
  }, [orders]);

  const sofortCount = empfehlungen.filter(e => e.dringlichkeit === 'sofort').length;

  if (empfehlungen.length === 0) return null;

  return (
    <div className="rounded-xl border border-matcha-200 dark:border-matcha-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
      >
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Küchen-Priorisierungs-Assistent</span>
          {sofortCount > 0 && (
            <span className="flex items-center gap-1 rounded-full border border-red-300 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-bold text-red-700 dark:text-red-300 animate-pulse">
              <AlertTriangle className="h-3 w-3" />
              {sofortCount} Sofort
            </span>
          )}
          <span className="rounded-full bg-matcha-100 dark:bg-matcha-900/30 px-2 py-0.5 text-xs font-semibold text-matcha-700 dark:text-matcha-300">
            {empfehlungen.length} wartend
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-xs text-muted-foreground mb-3">
            Empfohlene Startreihenfolge nach ETA-Dringlichkeit + Kochstation
          </p>

          {empfehlungen.map((e, idx) => {
            const style = dringlichkeitStyle(e.dringlichkeit);
            return (
              <div
                key={e.orderId}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-3',
                  e.dringlichkeit === 'sofort'
                    ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                    : e.dringlichkeit === 'bald'
                    ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
                    : 'bg-matcha-50 dark:bg-matcha-900/10 border-matcha-200 dark:border-matcha-800'
                )}
              >
                {/* Rank */}
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  {idx + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">#{e.bestellnummer}</span>
                    <span className="text-base">{e.station_emoji}</span>
                    <span className="text-xs text-zinc-500">{e.station}</span>
                    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold', style.badge)}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', style.dot, e.dringlichkeit === 'sofort' && 'animate-ping')} />
                      {style.label}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{e.grund}</p>

                  <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {e.minuten_bis_deadline > 0 ? `${e.minuten_bis_deadline} Min bis Deadline` : `${Math.abs(e.minuten_bis_deadline)} Min überfällig`}
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {e.artikel_anzahl} Artikel
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          <p className="text-[10px] text-muted-foreground/60 text-right pt-1">
            Prio-Berechnung: ETA-Dringlichkeit + Deadline-Nähe
          </p>
        </div>
      )}
    </div>
  );
}
