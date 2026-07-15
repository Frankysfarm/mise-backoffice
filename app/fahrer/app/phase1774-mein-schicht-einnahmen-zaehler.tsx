'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Banknote, RefreshCw, Target, TrendingUp } from 'lucide-react';

/**
 * Phase 1774 — Mein Schicht-Einnahmen-Zähler (Fahrer-App)
 *
 * Echtzeit-Einnahmen heute + Prognose bis Schichtende + Zielfortschrittsleiste.
 * isOnline-Guard; 5-Min-Polling.
 */

interface SchichtEinnahmenZaehlerAntwort {
  fahrer_id: string;
  einnahmen_heute_eur: number;
  prognose_schicht_ende_eur: number;
  ziel_eur: number;
  ziel_fortschritt_pct: number;
  bestellungen_heute: number;
  schicht_dauer_h: number;
  generiert_am: string;
}

interface Props {
  driverId: string | null;
  isOnline: boolean;
  className?: string;
}

export function FahrerPhase1774MeinSchichtEinnahmenZaehler({ driverId, isOnline, className }: Props) {
  const [data, setData] = useState<SchichtEinnahmenZaehlerAntwort | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!driverId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/driver/schicht-einnahmen-zaehler?driver_id=${driverId}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isOnline || !driverId) return;
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, driverId]);

  if (!isOnline) return null;

  const fortschritt = data?.ziel_fortschritt_pct ?? 0;
  const zielErreicht = fortschritt >= 100;

  return (
    <div className={cn('rounded-xl border border-border bg-card p-4 mb-3', className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Banknote className="h-4 w-4 text-saffron" />
          <span className="text-sm font-bold">Meine Schicht-Einnahmen</span>
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
          <span>Lade Einnahmen…</span>
        </div>
      )}

      {data && (
        <div className="space-y-3">
          {/* Main earnings display */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/40 p-3 text-center">
              <div className="text-xl font-black tabular-nums text-foreground">
                {data.einnahmen_heute_eur.toFixed(2)} €
              </div>
              <div className="text-[10px] text-muted-foreground uppercase mt-0.5">Heute</div>
              <div className="text-[10px] text-muted-foreground">{data.bestellungen_heute} Bestellungen</div>
            </div>
            <div className="rounded-lg bg-saffron/10 p-3 text-center">
              <div className="flex items-center justify-center gap-1">
                <TrendingUp className="h-3.5 w-3.5 text-saffron" />
                <div className="text-xl font-black tabular-nums text-saffron">
                  {data.prognose_schicht_ende_eur.toFixed(2)} €
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground uppercase mt-0.5">Prognose</div>
              <div className="text-[10px] text-muted-foreground">Schichtende ({data.schicht_dauer_h}h)</div>
            </div>
          </div>

          {/* Goal progress */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Schichtziel</span>
              </div>
              <span className={cn(
                'text-xs font-bold tabular-nums',
                zielErreicht ? 'text-green-600 dark:text-green-400' : 'text-foreground',
              )}>
                {fortschritt}% von {data.ziel_eur.toFixed(2)} €
              </span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  zielErreicht ? 'bg-green-500' : fortschritt >= 75 ? 'bg-saffron' : 'bg-saffron/60',
                )}
                style={{ width: `${Math.min(100, fortschritt)}%` }}
              />
            </div>
            {zielErreicht && (
              <p className="text-[10px] font-bold text-green-600 dark:text-green-400 mt-1 text-center">
                Schichtziel erreicht!
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
