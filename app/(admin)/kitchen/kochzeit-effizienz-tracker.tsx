'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ─── Typen ────────────────────────────────────────────────────────────────────

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  fertig_am: string | null;
  geschaetzte_zubereitung_min: number | null;
}

interface Timing {
  order_id: string;
  cook_start_at: string | null;
  prep_min: number | null;
}

interface Props {
  orders: Order[];
  timings: Timing[];
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function diffMinutes(from: string, to: string): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / 60_000;
}

type AccuracyGrade = 'gut' | 'okay' | 'zu_langsam';

function gradeAccuracy(pct: number): AccuracyGrade {
  if (pct > 90) return 'gut';
  if (pct >= 70) return 'okay';
  return 'zu_langsam';
}

const GRADE_CONFIG: Record<
  AccuracyGrade,
  { bg: string; text: string; border: string; label: string; icon: React.ElementType }
> = {
  gut: {
    bg: 'bg-matcha-50',
    text: 'text-matcha-700',
    border: 'border-matcha-200',
    label: 'Gut',
    icon: TrendingUp,
  },
  okay: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    label: 'Okay',
    icon: Minus,
  },
  zu_langsam: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    label: 'Zu langsam',
    icon: TrendingDown,
  },
};

// ─── Berechnete Daten ─────────────────────────────────────────────────────────

interface CompletedEntry {
  bestellnummer: string;
  estimateMin: number;
  actualMin: number;
  accuracyPct: number;
  deltaMin: number;
}

function buildEntries(orders: Order[], timings: Timing[]): CompletedEntry[] {
  const timingMap = new Map<string, Timing>();
  for (const t of timings) {
    timingMap.set(t.order_id, t);
  }

  const entries: CompletedEntry[] = [];

  for (const order of orders) {
    const isDone = order.status === 'geliefert' || order.status === 'fertig';
    if (!isDone || !order.bestellt_am || !order.fertig_am) continue;

    const timing = timingMap.get(order.id);
    const estimateMin = timing?.prep_min ?? order.geschaetzte_zubereitung_min ?? 20;
    const startAt = timing?.cook_start_at ?? order.bestellt_am;
    const actualMin = diffMinutes(startAt, order.fertig_am);

    if (actualMin <= 0) continue;

    // Cap accuracy 0–200%
    const rawAccuracy = (estimateMin / actualMin) * 100;
    const accuracyPct = Math.min(200, Math.max(0, rawAccuracy));
    const deltaMin = actualMin - estimateMin;

    entries.push({
      bestellnummer: order.bestellnummer,
      estimateMin,
      actualMin: Math.round(actualMin),
      accuracyPct: Math.round(accuracyPct),
      deltaMin: Math.round(deltaMin),
    });
  }

  return entries;
}

// ─── Unterkomponenten ─────────────────────────────────────────────────────────

function GradeBadge({ grade }: { grade: AccuracyGrade }) {
  const cfg = GRADE_CONFIG[grade];
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-black',
        cfg.bg,
        cfg.text,
        cfg.border,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {cfg.label}
    </span>
  );
}

function DeltaLabel({ deltaMin }: { deltaMin: number }) {
  if (deltaMin > 0) {
    return (
      <span className="text-[10px] font-bold text-red-600 tabular-nums">
        +{deltaMin}&nbsp;Min
      </span>
    );
  }
  if (deltaMin < 0) {
    return (
      <span className="text-[10px] font-bold text-matcha-600 tabular-nums">
        {deltaMin}&nbsp;Min
      </span>
    );
  }
  return (
    <span className="text-[10px] font-bold text-muted-foreground tabular-nums">
      ±0&nbsp;Min
    </span>
  );
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

export function KitchenKochzeitEffizienzTracker({ orders, timings }: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  const entries = buildEntries(orders, timings);
  const count = entries.length;

  const avgAccuracy =
    count > 0
      ? Math.round(entries.reduce((s, e) => s + e.accuracyPct, 0) / count)
      : 0;

  const grade = gradeAccuracy(avgAccuracy);
  const gradeCfg = GRADE_CONFIG[grade];
  const GradeIcon = gradeCfg.icon;

  const lastThree = entries.slice(-3).reverse();

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      {/* ── Header ── */}
      <div className="flex items-center gap-2">
        <ChefHat className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider text-foreground/80">
          Kochzeit-Effizienz
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          alle 30s
        </span>
      </div>

      {/* ── KPIs ── */}
      {count === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
          <Clock className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">
            Noch keine abgeschlossenen Bestellungen
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {/* Avg accuracy */}
            <div
              className={cn(
                'rounded-lg border p-3 text-center',
                gradeCfg.bg,
                gradeCfg.border,
              )}
            >
              <div
                className={cn(
                  'text-2xl font-black tabular-nums leading-none',
                  gradeCfg.text,
                )}
              >
                {avgAccuracy}%
              </div>
              <div className="mt-1 flex items-center justify-center gap-1 text-[10px] font-semibold text-muted-foreground">
                <GradeIcon className={cn('h-3 w-3', gradeCfg.text)} />
                Ø Genauigkeit
              </div>
            </div>

            {/* Count + badge */}
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              <div className="text-2xl font-black tabular-nums text-foreground leading-none">
                {count}
              </div>
              <div className="mt-1 text-[10px] font-semibold text-muted-foreground">
                Abgeschlossen
              </div>
              <div className="mt-1.5 flex justify-center">
                <GradeBadge grade={grade} />
              </div>
            </div>
          </div>

          {/* ── Letzte 3 Bestellungen ── */}
          {lastThree.length > 0 && (
            <div>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Letzte {lastThree.length} Bestellungen
              </div>
              <div className="space-y-1">
                {lastThree.map((entry) => {
                  const entryGrade = gradeAccuracy(entry.accuracyPct);
                  const entryCfg = GRADE_CONFIG[entryGrade];
                  return (
                    <div
                      key={entry.bestellnummer}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-2.5 py-1.5',
                        entryCfg.bg,
                        entryCfg.border,
                      )}
                    >
                      <span className="text-[11px] font-bold text-foreground/80 tabular-nums shrink-0">
                        #{entry.bestellnummer}
                      </span>
                      <span className="flex-1 text-[10px] text-muted-foreground tabular-nums">
                        {entry.estimateMin}&nbsp;Min&nbsp;geschätzt&nbsp;/&nbsp;{entry.actualMin}&nbsp;Min&nbsp;real
                      </span>
                      <DeltaLabel deltaMin={entry.deltaMin} />
                      <span
                        className={cn(
                          'text-[11px] font-black tabular-nums shrink-0',
                          entryCfg.text,
                        )}
                      >
                        {entry.accuracyPct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
