'use client';

import { useCallback, useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';

interface Props {
  driverId: string;
}

interface EinnahmenDaten {
  touren_heute: number;
  einnahmen_eur: number;
  trinkgeld_eur: number;
  gesamt_eur: number;
  ziel_eur: number;
  prognose_eur: number;
}

const MOCK: EinnahmenDaten = {
  touren_heute: 5,
  einnahmen_eur: 4.00,
  trinkgeld_eur: 3.20,
  gesamt_eur: 7.20,
  ziel_eur: 20,
  prognose_eur: 14.40,
};

export function FahrerPhase759TagesEinnahmenCockpit({ driverId }: Props) {
  const [data, setData] = useState<EinnahmenDaten | null>(null);
  const [loading, setLoading] = useState(true);

  const laden = useCallback(async () => {
    if (!driverId) { setData(MOCK); setLoading(false); return; }
    try {
      const res = await fetch(
        `/api/delivery/driver/tages-bilanz?driver_id=${driverId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (typeof json.einnahmen_eur === 'number') {
          const einnahmen = json.einnahmen_eur ?? 0;
          const trinkgeld = json.trinkgeld_eur ?? 0;
          const gesamt = einnahmen + trinkgeld;
          const touren = json.touren_heute ?? 0;
          const schichtH = json.schicht_min ? json.schicht_min / 60 : 8;
          const prognose = schichtH > 0 ? Math.round((gesamt / Math.max(1, touren)) * (touren + Math.max(0, (schichtH - (touren * 0.5)))) * 100) / 100 : gesamt;
          setData({ touren_heute: touren, einnahmen_eur: einnahmen, trinkgeld_eur: trinkgeld, gesamt_eur: gesamt, ziel_eur: 20, prognose_eur: prognose });
          return;
        }
      }
    } catch { /* fallback */ }
    setData(MOCK);
  }, [driverId]);

  useEffect(() => {
    laden().finally(() => setLoading(false));
    const id = setInterval(laden, 5 * 60_000);
    return () => clearInterval(id);
  }, [laden]);

  if (loading || !data) return null;

  const pct = Math.min(100, Math.round((data.gesamt_eur / data.ziel_eur) * 100));

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Wallet className="h-4 w-4 text-emerald-500" />
        <span className="text-sm font-semibold">Einnahmen-Cockpit</span>
      </div>

      <div className="flex items-end gap-1 mb-1">
        <span className="text-4xl font-black tabular-nums text-emerald-600 dark:text-emerald-400">
          {data.gesamt_eur.toFixed(2)}
        </span>
        <span className="text-sm text-muted-foreground pb-1">/ {data.ziel_eur.toFixed(0)} €</span>
      </div>

      <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-muted/40 px-2 py-2">
          <p className="text-base font-bold tabular-nums">{data.einnahmen_eur.toFixed(2)}</p>
          <p className="text-[9px] text-muted-foreground">Touren €</p>
        </div>
        <div className="rounded-lg bg-muted/40 px-2 py-2">
          <p className="text-base font-bold tabular-nums text-amber-600 dark:text-amber-400">{data.trinkgeld_eur.toFixed(2)}</p>
          <p className="text-[9px] text-muted-foreground">Trinkgeld €</p>
        </div>
        <div className="rounded-lg bg-muted/40 px-2 py-2">
          <p className="text-base font-bold tabular-nums text-blue-600 dark:text-blue-400">{data.prognose_eur.toFixed(2)}</p>
          <p className="text-[9px] text-muted-foreground">Prognose €</p>
        </div>
      </div>
    </div>
  );
}
