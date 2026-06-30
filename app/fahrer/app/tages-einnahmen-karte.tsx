'use client';

/**
 * Phase 521 — FahrerTagesEinnahmenKarte
 *
 * Zeigt dem Fahrer eine Zusammenfassung seiner heutigen Einnahmen:
 * - Gesamtbetrag + Trend vs. gestern
 * - Aufschlüsselung: Basis / Trinkgeld / Bonus
 * - Stündliche Balken
 *
 * Pollt alle 2 Min /api/delivery/driver/tages-einnahmen.
 */

import { useEffect, useState, useCallback } from 'react';
import { Euro, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EinnahmenStunde {
  hour: number;
  lieferungen: number;
  trinkgeldEur: number;
  basisEur: number;
  totalEur: number;
}

interface TagesEinnahmenData {
  driverName: string;
  heute: {
    lieferungen: number;
    trinkgeldEur: number;
    basisEur: number;
    bonusEur: number;
    totalEur: number;
  };
  gestern: {
    lieferungen: number;
    totalEur: number;
  };
  deltaEur: number;
  deltaLieferungen: number;
  stunden: EinnahmenStunde[];
  aktivSeitMin: number | null;
}

interface Props {
  driverId?: string;
}

function eur(v: number): string {
  return v.toFixed(2).replace('.', ',') + ' €';
}

function formatMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function FahrerTagesEinnahmenKarte({ driverId }: Props) {
  const [data, setData] = useState<TagesEinnahmenData | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (driverId) params.set('driver_id', driverId);
      const res = await fetch(`/api/delivery/driver/tages-einnahmen?${params}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.ok) setData(json.data as TagesEinnahmenData);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [driverId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 2 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  if (loading && !data) return (
    <div className="rounded-xl border bg-card p-4 text-xs text-muted-foreground animate-pulse">Lade Einnahmen…</div>
  );

  if (!data) return null;

  const { heute, gestern, deltaEur, deltaLieferungen, stunden, aktivSeitMin } = data;
  const maxStunden = stunden.length > 0 ? Math.max(...stunden.map((s) => s.totalEur)) : 0;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Euro className="h-4 w-4 text-green-500" />
          <span className="font-semibold text-sm">Heutige Einnahmen</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-green-600 dark:text-green-400">
            {eur(heute.totalEur)}
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Compact summary always visible */}
      <div className="px-4 pb-3 flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">{heute.lieferungen} Lieferungen</span>
        <span className={cn(
          'flex items-center gap-0.5 font-medium',
          deltaEur > 0 ? 'text-green-600' : deltaEur < 0 ? 'text-red-500' : 'text-muted-foreground'
        )}>
          {deltaEur > 0 ? <TrendingUp className="h-3 w-3" /> : deltaEur < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          {deltaEur >= 0 ? '+' : ''}{eur(deltaEur)} vs. gestern
        </span>
        {aktivSeitMin !== null && (
          <span className="flex items-center gap-0.5 text-muted-foreground text-xs ml-auto">
            <Clock className="h-3 w-3" />
            {formatMin(aktivSeitMin)} aktiv
          </span>
        )}
      </div>

      {/* Expanded Details */}
      {open && (
        <div className="px-4 pb-4 border-t pt-3 space-y-4">
          {/* Aufschlüsselung */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-xs text-muted-foreground">Basis</p>
              <p className="font-bold text-sm mt-1">{eur(heute.basisEur)}</p>
            </div>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-center">
              <p className="text-xs text-amber-600 dark:text-amber-400">Trinkgeld</p>
              <p className="font-bold text-sm mt-1 text-amber-700 dark:text-amber-300">{eur(heute.trinkgeldEur)}</p>
            </div>
            <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-3 text-center">
              <p className="text-xs text-green-600 dark:text-green-400">Bonus</p>
              <p className="font-bold text-sm mt-1 text-green-700 dark:text-green-300">{eur(heute.bonusEur)}</p>
            </div>
          </div>

          {/* Stündliche Balken */}
          {stunden.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Stundenverteilung</p>
              <div className="flex items-end gap-1 h-16">
                {stunden.map((s) => {
                  const heightPct = maxStunden > 0 ? (s.totalEur / maxStunden) * 100 : 0;
                  return (
                    <div key={s.hour} className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
                      <div className="w-full flex items-end justify-center" style={{ height: 48 }}>
                        <div
                          className="w-full bg-green-400 dark:bg-green-600 rounded-t"
                          style={{ height: `${Math.max(4, heightPct)}%` }}
                          title={`${s.hour}:00 — ${eur(s.totalEur)} (${s.lieferungen} Lief.)`}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{s.hour}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Vergleich Gestern */}
          <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
            <span>Gestern: {eur(gestern.totalEur)} · {gestern.lieferungen} Lieferungen</span>
            <span className={cn(
              'font-medium',
              deltaLieferungen > 0 ? 'text-green-600' : deltaLieferungen < 0 ? 'text-red-500' : ''
            )}>
              {deltaLieferungen >= 0 ? '+' : ''}{deltaLieferungen} Lieferungen
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
