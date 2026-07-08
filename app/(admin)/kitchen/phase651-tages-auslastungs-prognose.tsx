'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';

interface Order {
  id: string;
  status: string;
  created_at: string;
}

interface Props {
  orders: Order[];
}

interface StundenBucket {
  stunde: number;
  label: string;
  bestellungen: number;
  isCurrent: boolean;
  isFuture: boolean;
}

function buildBuckets(orders: Order[]): StundenBucket[] {
  const jetzt = new Date();
  const aktuelleStunde = jetzt.getHours();
  const startOfDay = new Date(jetzt);
  startOfDay.setHours(0, 0, 0, 0);

  const counts: Record<number, number> = {};
  for (const o of orders) {
    const d = new Date(o.created_at);
    if (d >= startOfDay) {
      const h = d.getHours();
      counts[h] = (counts[h] ?? 0) + 1;
    }
  }

  const betriebStart = 10;
  const betriebEnde = 22;
  const buckets: StundenBucket[] = [];

  for (let h = betriebStart; h <= betriebEnde; h++) {
    buckets.push({
      stunde: h,
      label: `${h}:00`,
      bestellungen: counts[h] ?? 0,
      isCurrent: h === aktuelleStunde,
      isFuture: h > aktuelleStunde,
    });
  }

  return buckets;
}

function prognoseNaechste2h(buckets: StundenBucket[]): number {
  const aktuelleStunde = new Date().getHours();
  const vergangeneStunden = buckets.filter(
    (b) => !b.isFuture && !b.isCurrent && b.bestellungen > 0,
  );
  if (vergangeneStunden.length === 0) return 0;
  const avg =
    vergangeneStunden.reduce((s, b) => s + b.bestellungen, 0) /
    vergangeneStunden.length;
  const verbleibend = Math.min(2, Math.max(0, 22 - aktuelleStunde));
  return Math.round(avg * verbleibend);
}

function auslastungsLabel(prognose: number): { text: string; color: string } {
  if (prognose >= 20) return { text: 'Hohe Auslastung erwartet', color: 'text-red-600 dark:text-red-400' };
  if (prognose >= 10) return { text: 'Mittlere Auslastung erwartet', color: 'text-amber-600 dark:text-amber-400' };
  return { text: 'Geringe Auslastung erwartet', color: 'text-matcha-600 dark:text-matcha-400' };
}

export function KitchenPhase651TagesAuslastungsPrognose({ orders }: Props) {
  const [open, setOpen] = useState(true);
  const [buckets, setBuckets] = useState<StundenBucket[]>([]);
  const [prognose, setPrognose] = useState(0);

  const refresh = useCallback(() => {
    const b = buildBuckets(orders);
    setBuckets(b);
    setPrognose(prognoseNaechste2h(b));
  }, [orders]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  const maxBestellungen = Math.max(...buckets.map((b) => b.bestellungen), 1);
  const { text: auslastungsText, color: auslastungsColor } = auslastungsLabel(prognose);
  const heuteGesamt = buckets.reduce((s, b) => s + b.bestellungen, 0);

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-semibold">Tages-Auslastungs-Prognose</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {heuteGesamt} heute
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">Prognose nächste 2h</span>
              <span className={`text-lg font-bold tabular-nums ${auslastungsColor}`}>
                ~{prognose} Bestellungen
              </span>
            </div>
            <p className={`text-xs font-medium mt-0.5 ${auslastungsColor}`}>{auslastungsText}</p>
          </div>

          <div className="space-y-1">
            {buckets.map((b) => (
              <div key={b.stunde} className="flex items-center gap-2">
                <span
                  className={`w-10 shrink-0 text-[11px] tabular-nums ${
                    b.isCurrent
                      ? 'font-bold text-matcha-700 dark:text-matcha-400'
                      : b.isFuture
                      ? 'text-muted-foreground/50'
                      : 'text-muted-foreground'
                  }`}
                >
                  {b.label}
                </span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  {!b.isFuture && (
                    <div
                      className={`h-full rounded-full transition-all ${
                        b.isCurrent ? 'bg-matcha-500' : 'bg-slate-400 dark:bg-slate-500'
                      }`}
                      style={{ width: `${(b.bestellungen / maxBestellungen) * 100}%` }}
                    />
                  )}
                  {b.isFuture && (
                    <div
                      className="h-full rounded-full bg-muted-foreground/20"
                      style={{ width: `${(prognose / 2 / maxBestellungen) * 100}%` }}
                    />
                  )}
                </div>
                <span className={`w-6 shrink-0 text-right text-[11px] tabular-nums ${b.isFuture ? 'text-muted-foreground/40' : 'font-medium'}`}>
                  {b.isFuture ? '~' : b.bestellungen}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
