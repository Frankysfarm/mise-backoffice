'use client';

import { useCallback, useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Wallet } from 'lucide-react';

interface Props {
  driverId: string;
}

interface WochenData {
  aktuell_eur: number;
  vorwoche_eur: number;
  delta_pct: number;
  aktuell_touren: number;
  vorwoche_touren: number;
  aktuell_trinkgeld: number;
  vorwoche_trinkgeld: number;
}

const MOCK: WochenData = {
  aktuell_eur: 183.5,
  vorwoche_eur: 167.0,
  delta_pct: 10,
  aktuell_touren: 22,
  vorwoche_touren: 20,
  aktuell_trinkgeld: 28.0,
  vorwoche_trinkgeld: 22.5,
};

export function FahrerPhase694WochenEinnahmenCockpit({ driverId }: Props) {
  const [data, setData] = useState<WochenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const laden = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/delivery/driver/wochen-einnahmen?driver_id=${driverId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (json.aktuell_eur !== undefined) {
          setData(json);
          return;
        }
      }
    } catch {
      // fallback to mock
    }
    setData(MOCK);
    setLoading(false);
  }, [driverId]);

  useEffect(() => {
    laden().finally(() => setLoading(false));
    const id = setInterval(laden, 10 * 60_000);
    return () => clearInterval(id);
  }, [laden]);

  if (loading || !data) return null;

  const positive = data.delta_pct > 0;
  const neutral = data.delta_pct === 0;
  const TrendIcon = neutral ? Minus : positive ? TrendingUp : TrendingDown;
  const trendColor = neutral
    ? 'text-muted-foreground'
    : positive
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-sm font-semibold">Woche im Vergleich</span>
          <span className={`flex items-center gap-0.5 text-xs font-semibold ${trendColor}`}>
            <TrendIcon className="h-3.5 w-3.5" />
            {positive ? `+${data.delta_pct}` : data.delta_pct}%
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-[10px] text-muted-foreground">Diese Woche</p>
              <p className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                {data.aktuell_eur.toFixed(2)} €
              </p>
              <p className="text-[10px] text-muted-foreground">{data.aktuell_touren} Touren</p>
            </div>
            <div className="flex items-center justify-center">
              <div className={`flex flex-col items-center gap-0.5 ${trendColor}`}>
                <TrendIcon className="h-5 w-5" />
                <span className="text-xs font-bold">
                  {positive ? `+${data.delta_pct}` : data.delta_pct}%
                </span>
              </div>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-[10px] text-muted-foreground">Vorwoche</p>
              <p className="text-lg font-bold tabular-nums text-muted-foreground">
                {data.vorwoche_eur.toFixed(2)} €
              </p>
              <p className="text-[10px] text-muted-foreground">{data.vorwoche_touren} Touren</p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
            <span className="text-xs text-muted-foreground">Trinkgeld diese Woche</span>
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              {data.aktuell_trinkgeld.toFixed(2)} € <span className="text-[10px] text-muted-foreground">(Vorw.: {data.vorwoche_trinkgeld.toFixed(2)} €)</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
