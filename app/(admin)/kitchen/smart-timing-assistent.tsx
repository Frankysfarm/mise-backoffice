'use client';

/**
 * KitchenSmartTimingAssistent — Priorisierte "JETZT KOCHEN"-Liste für die Küche.
 *
 * Berechnet welche Bestellungen in den nächsten 5 Minuten mit dem Kochen beginnen müssen
 * (weil der Fahrer bald abholbereit sein wird), und rankt sie nach Dringlichkeit:
 *
 *  🔴 ROT  (animate-pulse): Kochstart überfällig oder in < 2 Min
 *  🟠 ORANGE:               Kochstart in 2–5 Min
 *  🟡 GELB:                 Kochstart in 5–10 Min
 *  🟢 GRÜN:                 Kochstart in > 10 Min
 *
 * Oben: kompaktes Ampel-Band mit Dringlichkeitsverteilung.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Clock, Timer, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
};

type KitchenTiming = {
  id: string;
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

type UrgencyLevel = 'rot' | 'orange' | 'gelb' | 'gruen';

interface CookEntry {
  orderId: string;
  bestellnummer: string;
  secsUntilCookStart: number; // negative = überfällig
  prepMin: number;
  urgency: UrgencyLevel;
}

// ---------------------------------------------------------------------------
// Urgency helpers
// ---------------------------------------------------------------------------

const URGENCY_THRESHOLDS = {
  rot: 2 * 60,    // < 2 Min oder überfällig
  orange: 5 * 60, // 2–5 Min
  gelb: 10 * 60,  // 5–10 Min
} as const;

function getUrgency(secsUntilStart: number): UrgencyLevel {
  if (secsUntilStart <= URGENCY_THRESHOLDS.rot) return 'rot';
  if (secsUntilStart <= URGENCY_THRESHOLDS.orange) return 'orange';
  if (secsUntilStart <= URGENCY_THRESHOLDS.gelb) return 'gelb';
  return 'gruen';
}

const URGENCY_STYLES: Record<UrgencyLevel, {
  row: string;
  dot: string;
  time: string;
  badge: string;
  label: string;
}> = {
  rot: {
    row: 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/40 animate-pulse',
    dot: 'bg-red-500',
    time: 'text-red-600 dark:text-red-400',
    badge: 'bg-red-500 text-white hover:bg-red-500',
    label: 'Sofort!',
  },
  orange: {
    row: 'border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/30',
    dot: 'bg-orange-500',
    time: 'text-orange-600 dark:text-orange-400',
    badge: 'bg-orange-500 text-white hover:bg-orange-500',
    label: 'Bald',
  },
  gelb: {
    row: 'border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950/30',
    dot: 'bg-yellow-500',
    time: 'text-yellow-700 dark:text-yellow-400',
    badge: 'bg-yellow-500 text-white hover:bg-yellow-500',
    label: 'In Kürze',
  },
  gruen: {
    row: 'border-matcha-200 bg-matcha-50 dark:border-matcha-700 dark:bg-matcha-950/20',
    dot: 'bg-matcha-500',
    time: 'text-matcha-700 dark:text-matcha-400',
    badge: 'bg-matcha-500 text-white hover:bg-matcha-500',
    label: 'Geplant',
  },
};

const URGENCY_ORDER: Record<UrgencyLevel, number> = {
  rot: 0,
  orange: 1,
  gelb: 2,
  gruen: 3,
};

// ---------------------------------------------------------------------------
// useTick — forces re-render every second
// ---------------------------------------------------------------------------

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fmtCountdown(secs: number): string {
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtTimeLabel(secs: number): string {
  if (secs <= 0) {
    return `+${fmtCountdown(secs)} überfällig`;
  }
  return `in ${fmtCountdown(secs)}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Kompaktes horizontales Ampel-Band oben im Header */
function UrgencyBand({ entries }: { entries: CookEntry[] }) {
  const counts: Record<UrgencyLevel, number> = { rot: 0, orange: 0, gelb: 0, gruen: 0 };
  for (const e of entries) counts[e.urgency]++;

  const slots: Array<{ level: UrgencyLevel; label: string; count: number }> = [
    { level: 'rot',    label: 'Sofort',  count: counts.rot    },
    { level: 'orange', label: '<5 Min',  count: counts.orange },
    { level: 'gelb',   label: '<10 Min', count: counts.gelb   },
    { level: 'gruen',  label: '>10 Min', count: counts.gruen  },
  ];

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {slots.map(({ level, label, count }) => {
        const s = URGENCY_STYLES[level];
        return (
          <div
            key={level}
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition-opacity',
              count === 0 ? 'opacity-30' : 'opacity-100',
              s.badge,
            )}
          >
            <span className="tabular-nums font-black">{count}</span>
            <span className="hidden sm:inline">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Eine Zeile in der JETZT-KOCHEN-Liste */
function CookEntryRow({ entry }: { entry: CookEntry }) {
  const s = URGENCY_STYLES[entry.urgency];
  const isOverdue = entry.secsUntilCookStart <= 0;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2 transition-all',
        s.row,
      )}
    >
      {/* Dot indicator */}
      <div className={cn('h-2.5 w-2.5 shrink-0 rounded-full', s.dot)} />

      {/* Bestellnummer */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-black text-foreground tabular-nums">
            #{entry.bestellnummer}
          </span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 shrink-0">
            <Timer className="h-2.5 w-2.5" />
            {entry.prepMin} Min Zubereitung
          </span>
        </div>
      </div>

      {/* Countdown + Label */}
      <div className="text-right shrink-0">
        <div className={cn('font-mono font-black text-sm tabular-nums leading-none', s.time)}>
          {isOverdue ? `+${fmtCountdown(entry.secsUntilCookStart)}` : fmtCountdown(entry.secsUntilCookStart)}
        </div>
        <div className={cn('text-[9px] font-semibold uppercase tracking-wide mt-0.5', s.time)}>
          {isOverdue ? 'ÜBERFÄLLIG' : 'bis Start'}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function KitchenSmartTimingAssistent({
  orders,
  timings,
}: {
  orders: Array<{
    id: string;
    bestellnummer: string;
    status: string;
    bestellt_am: string | null;
    geschaetzte_zubereitung_min: number | null;
  }>;
  timings: Array<{
    id: string;
    order_id: string;
    cook_start_at: string | null;
    ready_target: string | null;
    prep_min: number | null;
    status: string;
  }>;
}) {
  useTick();

  const now = Date.now();

  // --- Berechne Einträge aus kitchen_timings (scheduled / cooking) ---
  const SHOW_HORIZON_SECS = 10 * 60; // Zeige Bestellungen mit Kochstart in max. 10 Min

  const entries: CookEntry[] = [];

  for (const t of timings) {
    if (t.status !== 'scheduled' && t.status !== 'cooking') continue;
    if (!t.cook_start_at) continue;

    const order = orders.find((o) => o.id === t.order_id);
    if (!order) continue;
    if (!['bestätigt', 'in_zubereitung'].includes(order.status)) continue;

    const cookStartMs = new Date(t.cook_start_at).getTime();
    const secsUntilCookStart = Math.floor((cookStartMs - now) / 1000);

    // Nur Bestellungen zeigen, deren Kochstart innerhalb des Zeithorizonts liegt
    // Überfällige immer anzeigen (secsUntilCookStart < 0)
    if (secsUntilCookStart > SHOW_HORIZON_SECS) continue;

    const prepMin = t.prep_min ?? order.geschaetzte_zubereitung_min ?? 15;

    entries.push({
      orderId: order.id,
      bestellnummer: order.bestellnummer,
      secsUntilCookStart,
      prepMin,
      urgency: getUrgency(secsUntilCookStart),
    });
  }

  // --- Fallback: Bestellungen ohne Timing, bei denen Kochstart schon jetzt wäre ---
  for (const order of orders) {
    if (!['bestätigt', 'in_zubereitung'].includes(order.status)) continue;
    if (timings.some((t) => t.order_id === order.id)) continue; // hat schon Timing
    if (!order.bestellt_am) continue;

    // Schätze: Kochstart sollte bei Bestelleingang gewesen sein (bestell_am)
    const bestelltMs = new Date(order.bestellt_am).getTime();
    const secsUntilCookStart = Math.floor((bestelltMs - now) / 1000); // negativ = überfällig

    if (secsUntilCookStart > SHOW_HORIZON_SECS) continue;

    const prepMin = order.geschaetzte_zubereitung_min ?? 15;

    entries.push({
      orderId: order.id,
      bestellnummer: order.bestellnummer,
      secsUntilCookStart,
      prepMin,
      urgency: getUrgency(secsUntilCookStart),
    });
  }

  // --- Keine aktiven Timings → nichts anzeigen ---
  if (entries.length === 0) return null;

  // --- Sortieren: dringlichste zuerst, bei gleicher Dringlichkeit: frühester Start ---
  const sorted = [...entries].sort((a, b) => {
    const urgencyDiff = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;
    return a.secsUntilCookStart - b.secsUntilCookStart;
  });

  const rotCount = sorted.filter((e) => e.urgency === 'rot').length;
  const hasUrgent = rotCount > 0;

  return (
    <Card className={cn(
      'overflow-hidden transition-all duration-500',
      hasUrgent
        ? 'border-red-400 shadow-[0_0_16px_rgba(239,68,68,0.18)] dark:border-red-700'
        : 'border-border',
    )}>
      <CardHeader className={cn(
        'flex flex-row items-center gap-2 px-4 py-2.5 border-b space-y-0',
        hasUrgent
          ? 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'
          : 'bg-muted/30',
      )}>
        <Zap className={cn(
          'h-4 w-4 shrink-0',
          hasUrgent ? 'text-red-600 dark:text-red-400' : 'text-matcha-600 dark:text-matcha-400',
        )} />
        <CardTitle className="text-xs font-bold uppercase tracking-wider flex-1">
          Smart-Timing
        </CardTitle>

        {/* Ampel-Band */}
        <UrgencyBand entries={sorted} />

        {/* Gesamtanzahl */}
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground ml-1 shrink-0">
          <Clock className="h-3 w-3" />
          <span className="tabular-nums font-mono">{sorted.length}</span>
        </div>
      </CardHeader>

      <CardContent className="p-3 space-y-1.5">
        {/* Header-Label JETZT KOCHEN wenn dringlich */}
        {hasUrgent && (
          <div className="flex items-center gap-2 px-1 pb-0.5">
            <ChefHat className="h-3.5 w-3.5 text-red-500 shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 animate-pulse">
              Jetzt kochen!
            </span>
            <span className="ml-auto rounded-full bg-red-500 text-white text-[9px] font-black px-2 py-0.5 animate-pulse">
              {rotCount}
            </span>
          </div>
        )}

        {/* Rangliste */}
        <div className="space-y-1">
          {sorted.map((entry) => (
            <CookEntryRow key={entry.orderId} entry={entry} />
          ))}
        </div>

        {/* Legende */}
        <div className="flex items-center gap-3 pt-2 border-t border-border/50 flex-wrap">
          {(
            [
              { level: 'rot',    label: '< 2 Min / überfällig' },
              { level: 'orange', label: '2–5 Min'               },
              { level: 'gelb',   label: '5–10 Min'              },
              { level: 'gruen',  label: '> 10 Min'              },
            ] as Array<{ level: UrgencyLevel; label: string }>
          ).map(({ level, label }) => (
            <span key={level} className="flex items-center gap-1 text-[9px] text-muted-foreground">
              <span className={cn('h-2 w-2 rounded-full inline-block shrink-0', URGENCY_STYLES[level].dot)} />
              {label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
