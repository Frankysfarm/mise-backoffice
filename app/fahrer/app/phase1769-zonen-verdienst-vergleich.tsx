'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, RefreshCw, TrendingUp } from 'lucide-react';

/**
 * Phase 1769 — Zonen-Verdienst-Vergleich (Fahrer-App)
 *
 * Ø Verdienst je Zone für diesen Fahrer letzte 7 Tage.
 * Beste Zone hervorheben; isOnline-Guard; 30-Min-Polling.
 */

interface ZonenVerdienst {
  zone: 'A' | 'B' | 'C' | 'D';
  touren: number;
  gesamt_verdienst_eur: number;
  avg_verdienst_eur: number;
  avg_dauer_min: number;
  verdienst_pro_stunde: number;
}

interface ZonenVerdienstAntwort {
  fahrer_id: string;
  zonen: ZonenVerdienst[];
  beste_zone: 'A' | 'B' | 'C' | 'D' | null;
  generiert_am: string;
}

interface Props {
  driverId: string | null;
  isOnline: boolean;
  className?: string;
}

const ZONE_LABELS: Record<string, string> = { A: '0–2 km', B: '2–4 km', C: '4–7 km', D: '7+ km' };

export function FahrerPhase1769ZonenVerdienstVergleich({ driverId, isOnline, className }: Props) {
  const [data, setData] = useState<ZonenVerdienstAntwort | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!driverId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/driver/zonen-verdienst-vergleich?driver_id=${driverId}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isOnline || !driverId) return;
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, driverId]);

  if (!isOnline) return null;

  const aktiveZonen = data?.zonen.filter(z => z.touren > 0) ?? [];
  const maxVph = aktiveZonen.length > 0 ? Math.max(...aktiveZonen.map(z => z.verdienst_pro_stunde), 1) : 1;

  return (
    <div className={cn('rounded-xl border border-border bg-card p-4 mb-3', className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-saffron" />
          <span className="text-sm font-bold">Mein Zonen-Verdienst (7 Tage)</span>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded p-1 hover:bg-muted transition-colors"
          aria-label="Aktualisieren"
        >
          <RefreshCw className={cn('h-3.5 w-3.5 text-muted-foreground', loading && 'animate-spin')} />
        </button>
      </div>

      {loading && !data && (
        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Lade Verdienst-Daten…</span>
        </div>
      )}

      {data && (
        <div className="space-y-2">
          {data.beste_zone && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
              <Star className="h-4 w-4 text-amber-500 fill-amber-400" />
              <span className="text-xs font-bold text-amber-800 dark:text-amber-200">
                Zone {data.beste_zone} ist deine profitabelste Zone!
              </span>
            </div>
          )}

          {data.zonen.map(z => {
            const isBest = z.zone === data.beste_zone;
            const barPct = maxVph > 0 ? Math.min(100, z.verdienst_pro_stunde / maxVph * 100) : 0;

            return (
              <div
                key={z.zone}
                className={cn(
                  'rounded-lg border px-3 py-2.5',
                  isBest
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
                    : 'bg-muted/40 border-transparent',
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    {isBest && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400" />}
                    <span className="text-xs font-bold text-foreground">Zone {z.zone}</span>
                    <span className="text-[10px] text-muted-foreground">{ZONE_LABELS[z.zone]}</span>
                  </div>
                  <div className="text-right">
                    <span className={cn('text-sm font-black tabular-nums', isBest ? 'text-amber-700 dark:text-amber-300' : 'text-foreground')}>
                      {z.verdienst_pro_stunde.toFixed(2)} €/h
                    </span>
                  </div>
                </div>

                <div className="w-full h-2 rounded-full bg-muted overflow-hidden mb-1.5">
                  <div
                    className={cn('h-full rounded-full transition-all', isBest ? 'bg-amber-400' : 'bg-saffron/60')}
                    style={{ width: `${barPct}%` }}
                  />
                </div>

                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>{z.touren} Tour{z.touren !== 1 ? 'en' : ''}</span>
                  <span>·</span>
                  <span>Ø {z.avg_verdienst_eur.toFixed(2)} € / Tour</span>
                  <span>·</span>
                  <span>Ø {z.avg_dauer_min} Min</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
