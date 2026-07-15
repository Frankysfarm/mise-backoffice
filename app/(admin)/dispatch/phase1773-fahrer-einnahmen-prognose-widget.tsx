'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Banknote, RefreshCw, TrendingDown, TrendingUp, Minus } from 'lucide-react';

/**
 * Phase 1773 — Fahrer-Einnahmen-Prognose-Widget (Dispatch)
 *
 * Phase1771-API: Tabelle Fahrer + Prognose + Trend-Pfeil.
 * 30-Min-Polling; in dispatch/client.tsx.
 */

interface FahrerEinnahmenPrognose {
  fahrer_id: string;
  name: string;
  aktive_touren: number;
  bestellungen_heute: number;
  einnahmen_heute_eur: number;
  prognose_schicht_ende_eur: number;
  trend_vs_gestern: 'up' | 'down' | 'gleich';
  trend_pct: number;
}

interface Antwort {
  fahrer: FahrerEinnahmenPrognose[];
  location_id: string;
  generiert_am: string;
}

interface Props {
  locationId: string | null;
  className?: string;
}

function TrendIcon({ trend, pct }: { trend: 'up' | 'down' | 'gleich'; pct: number }) {
  if (trend === 'up') return (
    <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
      <TrendingUp className="h-3 w-3" />
      <span className="text-[10px] font-bold">+{pct}%</span>
    </span>
  );
  if (trend === 'down') return (
    <span className="flex items-center gap-0.5 text-red-500 dark:text-red-400">
      <TrendingDown className="h-3 w-3" />
      <span className="text-[10px] font-bold">-{pct}%</span>
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-muted-foreground">
      <Minus className="h-3 w-3" />
      <span className="text-[10px]">±0%</span>
    </span>
  );
}

export function DispatchPhase1773FahrerEinnahmenPrognoseWidget({ locationId, className }: Props) {
  const [data, setData] = useState<Antwort | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  async function load() {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-einnahmen-prognose?location_id=${locationId}`);
      if (res.ok) {
        setData(await res.json());
        setLastFetch(new Date());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const maxPrognose = data ? Math.max(...data.fahrer.map(f => f.prognose_schicht_ende_eur), 1) : 1;

  return (
    <div className={cn('rounded-xl border border-border bg-card mb-3', className)}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Banknote className="h-4 w-4 text-saffron" />
          <span className="text-sm font-bold">Fahrer-Einnahmen-Prognose</span>
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

      <div className="px-4 pb-4">
        {!data ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Lade Prognose-Daten…</span>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 pb-1 border-b border-border">
              <span className="text-[9px] font-bold text-muted-foreground uppercase">Fahrer</span>
              <span className="text-[9px] font-bold text-muted-foreground uppercase text-right">Heute</span>
              <span className="text-[9px] font-bold text-muted-foreground uppercase text-right">Prognose</span>
              <span className="text-[9px] font-bold text-muted-foreground uppercase text-right">Trend</span>
            </div>

            {data.fahrer.map(f => {
              const barPct = maxPrognose > 0 ? Math.min(100, f.prognose_schicht_ende_eur / maxPrognose * 100) : 0;
              return (
                <div key={f.fahrer_id} className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center mb-2">
                    <div>
                      <p className="text-xs font-bold text-foreground">{f.name}</p>
                      <p className="text-[10px] text-muted-foreground">{f.bestellungen_heute} Best. · {f.aktive_touren} Tour{f.aktive_touren !== 1 ? 'en' : ''}</p>
                    </div>
                    <span className="text-xs font-bold tabular-nums text-foreground text-right">
                      {f.einnahmen_heute_eur.toFixed(2)} €
                    </span>
                    <span className="text-xs font-black tabular-nums text-saffron text-right">
                      {f.prognose_schicht_ende_eur.toFixed(2)} €
                    </span>
                    <div className="text-right">
                      <TrendIcon trend={f.trend_vs_gestern} pct={f.trend_pct} />
                    </div>
                  </div>
                  {/* Progress bar: today vs prognosis */}
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-saffron/70 transition-all"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {lastFetch && (
              <p className="text-[10px] text-muted-foreground text-right pt-1">
                Stand {lastFetch.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · alle 30 Min.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
