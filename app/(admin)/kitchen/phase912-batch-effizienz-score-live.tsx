'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Zap, ChevronDown, ChevronUp, TrendingDown, TrendingUp, AlertCircle } from 'lucide-react';

/**
 * Phase 912 — Batch-Effizienz-Score-Live
 *
 * Echtzeit-Score je laufendem Batch (0–100) berechnet aus:
 * - Pünktlichkeit (Artikel-Anzahl vs. Prep-Zeit-Budget)
 * - Bündelungs-Faktor (Stopps je Batch)
 * - Batch-Alter (je länger offen → Score sinkt)
 * Client-seitig, keine API notwendig.
 */

interface OrderItem {
  name: string;
  quantity?: number;
}

interface Order {
  id: string;
  status: string;
  bestellt_am: string | null;
  batch_id?: string | null;
  items?: OrderItem[];
}

interface Props {
  orders: Order[];
}

const ACTIVE_STATUSES = new Set(['neu', 'bestätigt', 'in_zubereitung', 'fertig']);
const BUDGET_MIN_PER_ITEM = 3;
const MAX_OPEN_MIN = 30;

interface BatchScore {
  batchKey: string;
  orderIds: string[];
  auftraege: number;
  artikelGesamt: number;
  alterMin: number;
  score: number;
  empfehlung: string;
}

function scoreColor(s: number) {
  if (s >= 80) return 'text-matcha-600 dark:text-matcha-400';
  if (s >= 55) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreBg(s: number) {
  if (s >= 80) return 'bg-matcha-500';
  if (s >= 55) return 'bg-amber-400';
  return 'bg-red-500';
}

function empfehlung(score: number, alterMin: number, artikelGesamt: number): string {
  if (alterMin > 20 && score < 60) return 'Sofort abschließen — Batch überfällig';
  if (artikelGesamt > 15 && score < 70) return 'Batch zu groß — aufteilen empfohlen';
  if (score >= 85) return 'Optimaler Batch — weiter so';
  if (score >= 70) return 'Gut — kürzere Wartezeit anstreben';
  return 'Artikel zügig vorbereiten';
}

export function KitchenPhase912BatchEffizienzScoreLive({ orders }: Props) {
  const [open, setOpen] = useState(false);

  const batches = useMemo<BatchScore[]>(() => {
    const now = Date.now();
    const aktiv = orders.filter((o) => ACTIVE_STATUSES.has(o.status));

    // Gruppiere nach batch_id (oder Einzel-Orders)
    const map = new Map<string, Order[]>();
    for (const o of aktiv) {
      const key = o.batch_id ?? `solo_${o.id}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }

    const result: BatchScore[] = [];
    for (const [key, grp] of map.entries()) {
      const oldest = grp.reduce((min, o) => {
        const t = o.bestellt_am ? new Date(o.bestellt_am).getTime() : now;
        return t < min ? t : min;
      }, now);
      const alterMin = Math.max(0, (now - oldest) / 60_000);
      const artikelGesamt = grp.reduce((s, o) => {
        return s + (o.items ?? []).reduce((as, i) => as + (i.quantity ?? 1), 0);
      }, 0);
      const auftraege = grp.length;

      // Score berechnen (0–100)
      // Bündelungs-Bonus: ≥3 Aufträge = +20 Pkt
      const buendelBonus = Math.min(20, auftraege * 7);
      // Alter-Malus: je Minute über Budget verliere 3 Punkte
      const budgetMin = Math.max(8, artikelGesamt * BUDGET_MIN_PER_ITEM);
      const ueberzogenMin = Math.max(0, alterMin - budgetMin);
      const alterMalus = Math.min(60, ueberzogenMin * 3);
      // Artikel-Penalty: Sehr große Batches (>12 Artikel) → -10
      const artikelMalus = artikelGesamt > 12 ? 10 : 0;

      const score = Math.max(0, Math.min(100, 80 + buendelBonus - alterMalus - artikelMalus));
      result.push({
        batchKey: key,
        orderIds: grp.map((o) => o.id),
        auftraege,
        artikelGesamt,
        alterMin: Math.round(alterMin),
        score: Math.round(score),
        empfehlung: empfehlung(score, alterMin, artikelGesamt),
      });
    }

    return result.sort((a, b) => a.score - b.score);
  }, [orders]);

  if (batches.length === 0) return null;

  const avgScore = Math.round(batches.reduce((s, b) => s + b.score, 0) / batches.length);
  const kritisch = batches.filter((b) => b.score < 55).length;

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      kritisch > 0 ? 'border-red-300 bg-red-50 dark:bg-red-950/30' : 'border-matcha-200 bg-matcha-50/40 dark:bg-matcha-950/20',
    )}>
      <button
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <Zap className={cn('h-4 w-4 shrink-0', kritisch > 0 ? 'text-red-500' : 'text-matcha-500')} />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-foreground">
          Batch-Effizienz-Score
        </span>
        {kritisch > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
            <AlertCircle className="h-3 w-3" />
            {kritisch} kritisch
          </span>
        )}
        <span className={cn('text-base font-black tabular-nums', scoreColor(avgScore))}>
          Ø {avgScore}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-border/40">
          {batches.map((b) => (
            <div key={b.batchKey} className="rounded-lg bg-background border border-border/60 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground shrink-0">
                  {b.auftraege === 1 ? 'Einzelauftrag' : `Batch (${b.auftraege} Aufträge)`}
                </span>
                <span className="text-[11px] text-muted-foreground">·</span>
                <span className="text-[11px] text-muted-foreground">{b.artikelGesamt} Artikel</span>
                <span className="text-[11px] text-muted-foreground">·</span>
                <span className="text-[11px] text-muted-foreground">{b.alterMin} Min offen</span>
                <span className={cn('ml-auto text-sm font-black tabular-nums', scoreColor(b.score))}>
                  {b.score}
                </span>
              </div>
              {/* Score-Bar */}
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-700', scoreBg(b.score))}
                  style={{ width: `${b.score}%` }}
                />
              </div>
              <div className="flex items-center gap-1.5">
                {b.score >= 80
                  ? <TrendingUp className="h-3 w-3 text-matcha-500 shrink-0" />
                  : <TrendingDown className="h-3 w-3 text-red-500 shrink-0" />
                }
                <span className="text-[11px] text-muted-foreground">{b.empfehlung}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
