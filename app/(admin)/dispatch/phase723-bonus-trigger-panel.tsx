'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Gift } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface EligibleFahrer {
  driver_id: string;
  name: string;
  touren_heute: number;
  bonus_eur: number;
}

const MOCK: EligibleFahrer[] = [
  { driver_id: '1', name: 'Max M.', touren_heute: 9, bonus_eur: 5.0 },
  { driver_id: '2', name: 'Lena K.', touren_heute: 8, bonus_eur: 5.0 },
];

export function DispatchPhase723BonusTriggerPanel({ locationId }: Props) {
  const [data, setData] = useState<EligibleFahrer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [ausgezahlt, setAusgezahlt] = useState<Set<string>>(new Set());
  const [zahlend, setZahlend] = useState<string | null>(null);

  const laden = useCallback(async () => {
    if (!locationId) {
      setData(MOCK);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/delivery/admin/fahrer-bonus-trigger?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.eligible)) {
          setData(json.eligible);
          return;
        }
      }
    } catch {
      // fallback
    }
    setData(MOCK);
  }, [locationId]);

  useEffect(() => {
    laden().finally(() => setLoading(false));
    const id = setInterval(laden, 5 * 60_000);
    return () => clearInterval(id);
  }, [laden]);

  async function zahleBonus(fahrer: EligibleFahrer) {
    if (!locationId) return;
    setZahlend(fahrer.driver_id);
    try {
      const res = await fetch('/api/delivery/admin/fahrer-bonus-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: fahrer.driver_id,
          bonus_eur: fahrer.bonus_eur,
          reason: 'Tagesziel erreicht',
          location_id: locationId,
        }),
      });
      if (res.ok) {
        setAusgezahlt((prev) => new Set([...prev, fahrer.driver_id]));
      }
    } catch {
      // ignore
    } finally {
      setZahlend(null);
    }
  }

  const pending = data.filter((f) => !ausgezahlt.has(f.driver_id));

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          <span className="text-sm font-semibold">Bonus-Auszahlung</span>
          {!loading && pending.length > 0 && (
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {pending.length} bereit
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="h-16 animate-pulse rounded bg-muted" />
          ) : data.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Kein Fahrer hat heute das Tagesziel erreicht</p>
          ) : (
            data.map((f) => {
              const done = ausgezahlt.has(f.driver_id);
              return (
                <div key={f.driver_id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">{f.name}</p>
                    <p className="text-[10px] text-muted-foreground">{f.touren_heute} Touren heute</p>
                  </div>
                  <button
                    onClick={() => zahleBonus(f)}
                    disabled={done || zahlend === f.driver_id}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      done
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 cursor-default'
                        : zahlend === f.driver_id
                        ? 'bg-muted text-muted-foreground cursor-wait'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {done ? '✓ Ausgezahlt' : zahlend === f.driver_id ? '...' : `+${f.bonus_eur} €`}
                  </button>
                </div>
              );
            })
          )}
          <p className="text-[10px] text-muted-foreground">5-Min Update · Tagesziel: 8 Touren · Bonus: 5 €</p>
        </div>
      )}
    </div>
  );
}
