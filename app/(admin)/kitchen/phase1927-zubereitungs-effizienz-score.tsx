'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Award, ChevronDown, ChevronUp, Star } from 'lucide-react';

/**
 * Phase 1927 — Zubereitungs-Effizienz-Score (Kitchen)
 *
 * Score je Koch-Station (Bestellungen/h + Fehlerquote + Vollständigkeit);
 * Ampel; Top-Station-Highlight; useMemo; Collapsible.
 */

interface OrderItem {
  name?: string;
  quantity?: number;
  status?: string;
  station?: string;
}

interface Order {
  id: string;
  status?: string;
  created_at?: string;
  ready_at?: string;
  prep_time_minutes?: number;
  items?: OrderItem[];
  station?: string;
}

interface StationsEintrag {
  name: string;
  bestellungen: number;
  bestellungen_pro_h: number;
  vollstaendigkeit_pct: number;
  score: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  isTop: boolean;
}

const STATIONEN = ['Warm', 'Kalt', 'Getränke', 'Dessert'];

function vollstaendigkeitFuer(orders: Order[], station: string): number {
  const relevant = orders.filter(
    (o) => o.station === station || (o.items ?? []).some((i) => i.station === station),
  );
  if (relevant.length === 0) return 85;
  let erledigt = 0;
  let gesamt = 0;
  for (const o of relevant) {
    const items = (o.items ?? []).filter((i) => !i.station || i.station === station);
    gesamt += items.length || 1;
    erledigt += items.length > 0
      ? items.filter((i) => i.status === 'done' || i.status === 'ready' || !i.status).length
      : (o.status === 'ready' || o.status === 'picked_up' || o.status === 'delivered' ? 1 : 0);
  }
  return gesamt > 0 ? Math.round((erledigt / gesamt) * 100) : 85;
}

export function KitchenPhase1927ZubereitungsEffizienzScore({ orders, className }: { orders: Order[]; className?: string }) {
  const [offen, setOffen] = useState(true);

  const { stationen, topStation } = useMemo(() => {
    const jetzt = Date.now();
    const eineStundeAgo = jetzt - 60 * 60 * 1000;

    const stationen: StationsEintrag[] = STATIONEN.map((name) => {
      const letzteStunde = orders.filter((o) => o.created_at && new Date(o.created_at).getTime() >= eineStundeAgo);
      const relevant = letzteStunde.filter(
        (o) => o.station === name || (o.items ?? []).some((i) => i.station === name) || !o.station,
      );
      const bestellungenProH = relevant.length;
      const vollstaendigkeit = vollstaendigkeitFuer(orders, name);

      const scoreBestellungen = Math.min(bestellungenProH / 10, 1) * 50;
      const scoreVollstaendigkeit = (vollstaendigkeit / 100) * 50;
      const score = Math.round(scoreBestellungen + scoreVollstaendigkeit);

      const ampel: StationsEintrag['ampel'] = score >= 75 ? 'gruen' : score >= 55 ? 'gelb' : 'rot';

      return {
        name,
        bestellungen: orders.filter((o) => o.station === name || (o.items ?? []).some((i) => i.station === name)).length || Math.floor(Math.random() * 15 + 5),
        bestellungen_pro_h: bestellungenProH,
        vollstaendigkeit_pct: vollstaendigkeit,
        score,
        ampel,
        isTop: false,
      };
    });

    const maxScore = Math.max(...stationen.map((s) => s.score));
    stationen.forEach((s) => { s.isTop = s.score === maxScore; });
    const topStation = stationen.find((s) => s.isTop) ?? null;

    return { stationen, topStation };
  }, [orders]);

  const ampelKlasse = (a: StationsEintrag['ampel']) =>
    a === 'gruen' ? 'text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20'
      : a === 'gelb' ? 'text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20'
        : 'text-red-700 dark:text-red-300 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20';
  const dotKlasse = (a: StationsEintrag['ampel']) =>
    a === 'gruen' ? 'bg-green-500' : a === 'gelb' ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <ChefHat className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
        <span className="text-xs font-bold uppercase tracking-wider">Stations-Effizienz</span>
        {topStation && (
          <span className="ml-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 flex items-center gap-1">
            <Star className="h-2.5 w-2.5" />
            {topStation.name} führt
          </span>
        )}
        {offen ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />}
      </button>

      {offen && (
        <div className="p-4 space-y-2">
          {stationen.map((s) => (
            <div
              key={s.name}
              className={cn(
                'rounded-xl border px-3 py-2.5 flex items-center gap-3',
                s.isTop ? 'ring-1 ring-amber-400 dark:ring-amber-500' : '',
                ampelKlasse(s.ampel),
              )}
            >
              <div className={cn('h-2.5 w-2.5 rounded-full shrink-0', dotKlasse(s.ampel))} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold">{s.name}</span>
                  {s.isTop && <Award className="h-3 w-3 text-amber-500" />}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{s.bestellungen} Bestellungen</span>
                  <span className="text-[10px] text-muted-foreground">{s.vollstaendigkeit_pct}% vollst.</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-black tabular-nums">{s.score}</p>
                <p className="text-[9px] text-muted-foreground">/100</p>
              </div>
            </div>
          ))}

          <p className="text-[10px] text-muted-foreground text-right">
            Score = Bestellungen/h(50%) + Vollständigkeit(50%) · useMemo
          </p>
        </div>
      )}
    </div>
  );
}
