'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1114 — Bestellrate-Prognose-Board (Kitchen)
// Berechnet aus den letzten Bestellungen die aktuelle Rate + prognostiziert Eingang nächste 30/60/90 Min

interface Item { name?: string; title?: string }
interface Order {
  id: string;
  status: string;
  created_at?: string | null;
  items?: Item[] | null;
}
interface Props { orders: Order[] }

type Prognose = {
  zeitraum: string;
  bestellungen: number;
  einheiten: number;   // estimated items
  auslastung: 'niedrig' | 'mittel' | 'hoch' | 'peak';
};

const AUSLASTUNGS_FARBE: Record<Prognose['auslastung'], string> = {
  niedrig: 'bg-emerald-500',
  mittel: 'bg-amber-400',
  hoch: 'bg-orange-500',
  peak: 'bg-red-500',
};

const AUSLASTUNGS_TEXT: Record<Prognose['auslastung'], string> = {
  niedrig: 'text-emerald-700 dark:text-emerald-300',
  mittel: 'text-amber-700 dark:text-amber-300',
  hoch: 'text-orange-700 dark:text-orange-300',
  peak: 'text-red-600 dark:text-red-400',
};

function auslastungLevel(bestellungen: number): Prognose['auslastung'] {
  if (bestellungen >= 12) return 'peak';
  if (bestellungen >= 7) return 'hoch';
  if (bestellungen >= 3) return 'mittel';
  return 'niedrig';
}

export function KitchenPhase1114BestellratePrognoseBoard({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const { rateProStunde, prognosen, rateLabel, rateTrend } = useMemo(() => {
    const now = Date.now();
    const seit30 = new Date(now - 30 * 60_000);
    const seit60 = new Date(now - 60 * 60_000);

    const letzte30 = orders.filter(o => o.created_at && new Date(o.created_at) >= seit30);
    const letzte60 = orders.filter(o => o.created_at && new Date(o.created_at) >= seit60);

    const rate30 = letzte30.length * 2;  // scale to per-hour
    const rate60 = letzte60.length;

    const rateProStunde = rate30 > 0 ? rate30 : rate60;
    const rateLabel = `${rateProStunde} Bestellungen/h`;
    const rateTrend: 'steigend' | 'fallend' | 'stabil' =
      rate30 > rate60 * 1.1 ? 'steigend' : rate30 < rate60 * 0.9 ? 'fallend' : 'stabil';

    // Average items per order
    const avgItems = letzte30.length
      ? letzte30.reduce((s, o) => s + (o.items?.length ?? 1), 0) / letzte30.length
      : 2;

    const prognosen: Prognose[] = [
      { zeitraum: 'nächste 30 Min', bestellungen: Math.round(rateProStunde * 0.5), einheiten: Math.round(rateProStunde * 0.5 * avgItems), auslastung: auslastungLevel(Math.round(rateProStunde * 0.5)) },
      { zeitraum: 'nächste 60 Min', bestellungen: rateProStunde, einheiten: Math.round(rateProStunde * avgItems), auslastung: auslastungLevel(rateProStunde) },
      { zeitraum: 'nächste 90 Min', bestellungen: Math.round(rateProStunde * 1.5), einheiten: Math.round(rateProStunde * 1.5 * avgItems), auslastung: auslastungLevel(Math.round(rateProStunde * 1.5)) },
    ];

    return { rateProStunde, prognosen, rateLabel, rateTrend };
  }, [orders]);

  const TrendIcon =
    rateTrend === 'steigend' ? TrendingUp : rateTrend === 'fallend' ? TrendingDown : Minus;
  const trendColor =
    rateTrend === 'steigend' ? 'text-orange-500' : rateTrend === 'fallend' ? 'text-emerald-600' : 'text-muted-foreground';

  if (!orders.length) return null;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-matcha-600 dark:text-matcha-400 shrink-0" />
          <span className="text-sm font-bold text-foreground">Bestellrate-Prognose</span>
          <span className={cn('text-xs font-semibold', trendColor)}>
            {rateLabel}
          </span>
          <TrendIcon className={cn('h-3 w-3', trendColor)} />
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Basierend auf den letzten 30 Minuten — Prognose für die Küche
          </p>

          <div className="space-y-2">
            {prognosen.map(p => (
              <div key={p.zeitraum} className="flex items-center gap-3">
                <div className="w-32 shrink-0 text-[11px] text-muted-foreground">{p.zeitraum}</div>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', AUSLASTUNGS_FARBE[p.auslastung])}
                      style={{ width: `${Math.min(100, (p.bestellungen / 20) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold tabular-nums w-6 text-right text-foreground">
                    {p.bestellungen}
                  </span>
                  <span className={cn('text-[10px] font-bold uppercase rounded px-1.5 py-0.5', AUSLASTUNGS_TEXT[p.auslastung], 'bg-current/10')}>
                    {p.auslastung}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-1 border-t text-[10px] text-muted-foreground flex items-center gap-1">
            <span>Ø {Math.round(prognosen[0].einheiten / Math.max(1, prognosen[0].bestellungen) * 10) / 10} Einheiten/Bestellung</span>
            <span>·</span>
            <span>Rate wird alle 5 Min aktualisiert</span>
          </div>
        </div>
      )}
    </div>
  );
}
