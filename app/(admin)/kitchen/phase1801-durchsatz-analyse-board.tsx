'use client';

import { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Activity, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';

/**
 * Phase 1801 — Durchsatz-Analyse-Board (Kitchen)
 *
 * Bestellungen/Stunde in der laufenden Schicht (ab 06:00 Uhr heute).
 * Zeigt: Aktueller Stunden-Durchsatz, Trend ggü. letzter Stunde,
 * Spitzenstunden-Highlight, Gesamtanzahl heute.
 * Props-basiert (kein API-Call); 30s-Tick; Collapsible.
 */

interface Order {
  id?: string;
  status?: string;
  created_at?: string;
  bestellt_am?: string;
}

interface Props {
  orders: Order[];
  className?: string;
}

type Trend = 'steigend' | 'fallend' | 'stabil';

function stundeVon(o: Order): number {
  const raw = o.bestellt_am ?? o.created_at ?? '';
  if (!raw) return -1;
  try {
    return new Date(raw).getHours();
  } catch {
    return -1;
  }
}

export function KitchenPhase1801DurchsatzAnalyseBoard({ orders, className }: Props) {
  const [open, setOpen] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const { stundenMap, aktuelleStunde, aktuellerDurchsatz, vorherigeDurchsatz, trend, spitzeStunde, spitzeAnzahl, heute } = useMemo(() => {
    const nowDate = new Date(now);
    const aktuelleStunde = nowDate.getHours();

    const stundenMap: Record<number, number> = {};
    let heute = 0;
    for (const o of orders) {
      const h = stundeVon(o);
      if (h < 6 || h > aktuelleStunde) continue;
      stundenMap[h] = (stundenMap[h] ?? 0) + 1;
      heute++;
    }

    const aktuellerDurchsatz = stundenMap[aktuelleStunde] ?? 0;
    const vorherigeDurchsatz = aktuelleStunde > 0 ? (stundenMap[aktuelleStunde - 1] ?? 0) : 0;

    let trend: Trend = 'stabil';
    if (aktuellerDurchsatz > vorherigeDurchsatz + 1) trend = 'steigend';
    else if (aktuellerDurchsatz < vorherigeDurchsatz - 1) trend = 'fallend';

    let spitzeStunde = aktuelleStunde;
    let spitzeAnzahl = 0;
    for (const [h, n] of Object.entries(stundenMap)) {
      if (n > spitzeAnzahl) {
        spitzeAnzahl = n;
        spitzeStunde = Number(h);
      }
    }

    return { stundenMap, aktuelleStunde, aktuellerDurchsatz, vorherigeDurchsatz, trend, spitzeStunde, spitzeAnzahl, heute };
  }, [orders, now]);

  const TrendIcon = trend === 'steigend' ? TrendingUp : trend === 'fallend' ? TrendingDown : Minus;
  const trendColor = trend === 'steigend' ? 'text-matcha-600 dark:text-matcha-400' : trend === 'fallend' ? 'text-red-500' : 'text-muted-foreground';
  const istSpitze = aktuelleStunde === spitzeStunde;
  const maxVal = Math.max(...Object.values(stundenMap), 1);

  const stundenListe = Array.from({ length: Math.max(0, aktuelleStunde - 5) }, (_, i) => 6 + i).filter(h => h <= aktuelleStunde);

  if (heute === 0) return null;

  return (
    <div className={cn('rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="h-4 w-4 shrink-0 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider truncate">
            Durchsatz-Analyse
          </span>
          <span className="rounded-full bg-matcha-50 dark:bg-matcha-950/30 border border-matcha-200 dark:border-matcha-800 px-2 py-0.5 text-[10px] font-bold text-matcha-700 dark:text-matcha-300 flex items-center gap-1">
            {aktuellerDurchsatz}/h <TrendIcon className={cn('h-2.5 w-2.5', trendColor)} />
          </span>
          {istSpitze && aktuellerDurchsatz > 0 && (
            <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
              <Zap className="h-2.5 w-2.5" /> Spitzenstunde
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-3">
          {/* Stunden-Balkendiagramm */}
          {stundenListe.length > 1 && (
            <div>
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">
                Stunden-Verlauf (Schicht ab 06:00)
              </div>
              <div className="flex items-end gap-1 h-16">
                {stundenListe.map(h => {
                  const n = stundenMap[h] ?? 0;
                  const pct = (n / maxVal) * 100;
                  const isAktuell = h === aktuelleStunde;
                  const isSp = h === spitzeStunde;
                  return (
                    <div key={h} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex flex-col justify-end" style={{ height: 48 }}>
                        <div
                          className={cn(
                            'w-full rounded-t-sm transition-all',
                            isAktuell ? 'bg-matcha-500' : isSp ? 'bg-amber-400' : 'bg-matcha-200 dark:bg-matcha-800/50',
                          )}
                          style={{ height: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                      <span className={cn('text-[8px] tabular-nums', isAktuell ? 'text-matcha-600 font-bold' : 'text-muted-foreground')}>
                        {h}h
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* KPI-Kacheln */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border bg-muted/30 p-2 text-center">
              <div className="text-[10px] text-muted-foreground mb-0.5">Jetzt /h</div>
              <div className={cn('text-lg font-black tabular-nums', trendColor)}>{aktuellerDurchsatz}</div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-2 text-center">
              <div className="text-[10px] text-muted-foreground mb-0.5">Letzte Stunde</div>
              <div className="text-lg font-black tabular-nums text-foreground">{vorherigeDurchsatz}</div>
            </div>
            <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 p-2 text-center">
              <div className="text-[10px] text-amber-700 dark:text-amber-300 mb-0.5">Spitze</div>
              <div className="text-lg font-black tabular-nums text-amber-700 dark:text-amber-300">
                {spitzeAnzahl}<span className="text-[9px] font-normal ml-0.5">@{spitzeStunde}h</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Gesamt heute: <strong className="text-foreground">{heute}</strong> Bestellungen</span>
            <span className={cn('flex items-center gap-1 font-semibold', trendColor)}>
              <TrendIcon className="h-3 w-3" /> {trend === 'steigend' ? 'Zunehmend' : trend === 'fallend' ? 'Abnehmend' : 'Stabil'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
